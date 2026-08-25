const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const storage = require('../utils/storage');
const { slugify } = require('../utils/widget');
const { ensureForOwner } = require('../services/businesses');
const { buildVenueDetail } = require('../services/venuePayload');

// Derive a unique, URL-safe slug for a venue's branded page. On collision the
// slug is suffixed -2, -3, ... so the page URL stays stable and human-typed.
async function uniqueSlug(client, name) {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  // An existing row is a collision whether it is this venue or another; the
  // loop keeps probing until a free slug is found.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await client.query(`select 1 from venues where slug = $1 limit 1`, [candidate]);
    if (rows.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function resolveSportIds(client, sports) {
  if (!Array.isArray(sports) || sports.length === 0) {
    throw Object.assign(new Error('At least one sport is required'), { status: 400, code: 'VENUE_VALIDATION' });
  }
  const { rows } = await client.query(
    `select id, slug from sports where slug = any($1)`,
    [sports]
  );
  const found = new Map(rows.map((r) => [r.slug, r.id]));
  const missing = sports.filter((s) => !found.has(s));
  if (missing.length > 0) {
    throw Object.assign(new Error(`Unknown sports: ${missing.join(', ')}`), { status: 400, code: 'VENUE_VALIDATION' });
  }
  return found;
}

exports.createVenue = async (req, res) => {
  const client = await pool.connect();
  try {
    // ADR-0022: only onboarded (accepted-terms) owners may create venues.
    // Self-submit by players is deprecated; admins pass through.
    if (req.user.role !== 'admin' && req.user.onboarding_state === 'pending') {
      return fail(res, 403, 'ONBOARDING_REQUIRED', 'Accept your owner agreement before creating venues');
    }

    const { name, description, address, city, phone, lat, lng, photos, amenities, sports, courts, hours, accepts_cash, venue_tax_rate } = req.body;

    if (!name || !city || !address) {
      return fail(res, 400, 'VENUE_VALIDATION', 'name, city, and address are required');
    }
    if (!Array.isArray(courts) || courts.length === 0) {
      return fail(res, 400, 'VENUE_VALIDATION', 'At least one court is required');
    }

    const venueTax = venue_tax_rate === undefined ? 0 : Number(venue_tax_rate);
    if (!Number.isFinite(venueTax) || venueTax < 0 || venueTax > 100) {
      return fail(res, 400, 'VENUE_VALIDATION', 'venue_tax_rate must be a number between 0 and 100');
    }

    const sportIds = await resolveSportIds(client, sports || []);

    for (const court of courts) {
      if (!court.name || court.price_per_slot === undefined) {
        return fail(res, 400, 'VENUE_VALIDATION', 'Each court needs a name and price_per_slot');
      }
      if (!sportIds.has(court.sport)) {
        return fail(res, 400, 'VENUE_VALIDATION', `Unknown sport on court: ${court.sport}`);
      }
    }

    await client.query('begin');

    const slug = await uniqueSlug(client, name);
    // New venues join the owner's Business (self-heal: create one if the
    // owner was provisioned before the Business model existed).
    const business = await ensureForOwner(req.user.id, name, client);

    const { rows: venueRows } = await client.query(
      `insert into venues (owner_id, business_id, name, description, address, city, phone, lat, lng, photos, amenities, status, accepts_cash, venue_tax_rate, slug)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, $14)
       returning *`,
      [
        req.user.id, business.id, name, description || null, address, city, phone || null,
        lat || null, lng || null,
        JSON.stringify(photos || []), JSON.stringify(amenities || []),
        !!accepts_cash, venueTax, slug
      ]
    );
    const venue = venueRows[0];

    for (const slug of sports || []) {
      await client.query(
        `insert into venue_sports (venue_id, sport_id) values ($1, $2) on conflict do nothing`,
        [venue.id, sportIds.get(slug)]
      );
    }

    const courtRows = [];
    for (const court of courts) {
      const { rows } = await client.query(
        `insert into courts (venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor`,
        [
          venue.id, sportIds.get(court.sport), court.name,
          court.capacity || null, court.price_per_slot,
          court.slot_duration_min || 60, !!court.is_indoor
        ]
      );
      courtRows.push(rows[0]);
    }

    for (const hour of hours || []) {
      await client.query(
        `insert into venue_hours (venue_id, day_of_week, open_time, close_time)
         values ($1, $2, $3, $4)`,
        [venue.id, hour.day_of_week, hour.open_time, hour.close_time]
      );
    }

    await client.query('commit');

    ok(res, 201, { ...venue, courts: courtRows });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    if (error.status) {
      return fail(res, error.status, error.code, error.message);
    }
    logger.error(`Error creating venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.listMyVenues = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select v.*, (select count(*)::int from courts c where c.venue_id = v.id) as court_count
       from venues v
       where v.owner_id = $1
       order by v.created_at desc`,
      [req.user.id]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing my venues: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.listVenues = async (req, res) => {
  try {
    const { search, sport, city, min_price, max_price, indoor, page = 1, limit = 20 } = req.query;

    const conditions = [`v.status = 'approved'`, `v.visibility = 'public'`];
    const values = [];
    let index = 1;

    if (search) {
      conditions.push(`v.name ilike $${index++}`);
      values.push(`%${search}%`);
    }
    if (city) {
      conditions.push(`v.city ilike $${index++}`);
      values.push(`%${city}%`);
    }
    if (sport) {
      conditions.push(`exists (select 1 from venue_sports vs join sports s on s.id = vs.sport_id where vs.venue_id = v.id and s.slug = $${index++})`);
      values.push(sport);
    }
    if (min_price !== undefined) {
      conditions.push(`exists (select 1 from courts c where c.venue_id = v.id and c.is_active and c.price_per_slot >= $${index++})`);
      values.push(Number(min_price));
    }
    if (max_price !== undefined) {
      conditions.push(`exists (select 1 from courts c where c.venue_id = v.id and c.is_active and c.price_per_slot <= $${index++})`);
      values.push(Number(max_price));
    }
    if (indoor !== undefined) {
      conditions.push(`exists (select 1 from courts c where c.venue_id = v.id and c.is_active and c.is_indoor = $${index++})`);
      values.push(indoor === 'true');
    }

    const where = `where ${conditions.join(' and ')}`;
    const offset = (Number(page) - 1) * Number(limit);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `select v.id, v.name, v.status, v.description, v.address, v.city, v.lat, v.lng, v.phone,
                v.photos, v.amenities, v.rules, v.cancellation_policy,
                coalesce(court_stats.min_price, null) as min_price,
                coalesce(court_stats.max_price, null) as max_price,
                coalesce((
                  select jsonb_agg(s.slug order by vs.sport_id)
                  from venue_sports vs join sports s on s.id = vs.sport_id
                  where vs.venue_id = v.id
                ), '[]'::jsonb) as sports
         from venues v
         left join (
           select venue_id, min(price_per_slot) as min_price, max(price_per_slot) as max_price
           from courts where is_active group by venue_id
         ) court_stats on court_stats.venue_id = v.id
         ${where}
         order by v.created_at desc
         limit $${index++} offset $${index}`,
        [...values, Number(limit), offset]
      ),
      pool.query(`select count(*)::int as total from venues v ${where}`, values)
    ]);

    ok(res, 200, rows, {
      page: Number(page),
      limit: Number(limit),
      total: countRows[0].total
    });
  } catch (error) {
    logger.error(`Error listing venues: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.getVenue = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `select v.* from venues v where v.id = $1 and v.status = 'approved' and v.visibility = 'public'`,
      [id]
    );

    if (rows.length === 0) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }

    const venue = rows[0];

    const [courtsRes, sportsRes, hoursRes] = await Promise.all([
      pool.query(
        `select c.id, c.name, c.capacity, c.price_per_slot, c.slot_duration_min,
                c.is_indoor, s.name as sport, s.slug as sport_slug
         from courts c
         left join sports s on s.id = c.sport_id
         where c.venue_id = $1 and c.is_active
         order by c.name`,
        [id]
      ),
      pool.query(
        `select s.name, s.slug, s.icon
         from venue_sports vs join sports s on s.id = vs.sport_id
         where vs.venue_id = $1 order by s.name`,
        [id]
      ),
      pool.query(
        `select day_of_week, open_time, close_time
         from venue_hours where venue_id = $1 order by day_of_week`,
        [id]
      )
    ]);

    ok(res, 200, {
      ...venue,
      courts: courtsRes.rows,
      sports: sportsRes.rows.map((s) => s.name),
      hours: hoursRes.rows
    });
  } catch (error) {
    logger.error(`Error fetching venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Public branded page lookup by slug (myslot.lk/<slug>). Gated on the
// business having at least one enabled Widget Instance: off means every
// off-platform surface of that business is dark while in-app visibility is
// unaffected. The payload carries venue + business presence (brand tokens)
// a storefront needs, never the owner's identity.
exports.getVenueBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }

    const { rows } = await pool.query(
      `select v.*, b.id as business_id, b.name as business_name, b.brand as business_brand
       from venues v
       join businesses b on b.id = v.business_id
       where v.slug = $1 and v.status = 'approved'
         and exists (
           select 1 from widget_instances wi
           where wi.business_id = v.business_id and wi.enabled
         )`,
      [slug]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }
    const venue = rows[0];

    const detail = await buildVenueDetail(venue);
    const { owner_id, business_id, business_name, business_brand, ...rest } = detail;
    ok(res, 200, {
      ...rest,
      business: { id: business_id, name: business_name, brand: business_brand }
    });
  } catch (error) {
    logger.error(`Error fetching venue by slug: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.updateVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address, city, phone, photos, amenities, accepts_cash, venue_tax_rate, cancel_cutoff_hours } = req.body;

    const { rows: venueRows } = await pool.query(
      `select * from venues where id = $1`,
      [id]
    );
    if (venueRows.length === 0) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }
    const venue = venueRows[0];
    if (venue.owner_id !== req.user.id && req.user.role !== 'admin') {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this venue');
    }

    // Venue Tax is owner-owned (ADR-0021): the admin may view it but not edit.
    if (venue_tax_rate !== undefined && req.user.role === 'admin' && venue.owner_id !== req.user.id) {
      return fail(res, 403, 'VENUE_TAX_OWNER_ONLY', 'Only the venue owner can change the Venue Tax rate');
    }
    let venueTax = null;
    if (venue_tax_rate !== undefined) {
      venueTax = Number(venue_tax_rate);
      if (!Number.isFinite(venueTax) || venueTax < 0 || venueTax > 100) {
        return fail(res, 400, 'VENUE_VALIDATION', 'venue_tax_rate must be a number between 0 and 100');
      }
    }

    let cancelCutoff = null;
    if (cancel_cutoff_hours !== undefined) {
      cancelCutoff = Number(cancel_cutoff_hours);
      if (!Number.isInteger(cancelCutoff) || cancelCutoff < 0 || cancelCutoff > 168) {
        return fail(res, 400, 'VENUE_VALIDATION', 'cancel_cutoff_hours must be a whole number between 0 and 168');
      }
    }

    const { rows: updated } = await pool.query(
      `update venues set
         name = coalesce($2, name),
         description = coalesce($3, description),
         address = coalesce($4, address),
         city = coalesce($5, city),
         phone = coalesce($6, phone),
         photos = coalesce($7::jsonb, photos),
         amenities = coalesce($8::jsonb, amenities),
         accepts_cash = coalesce($9, accepts_cash),
         venue_tax_rate = coalesce($10, venue_tax_rate),
         cancel_cutoff_hours = coalesce($11, cancel_cutoff_hours),
         updated_at = now()
       where id = $1
       returning *`,
      [
        id,
        name ?? null,
        description ?? null,
        address ?? null,
        city ?? null,
        phone ?? null,
        photos !== undefined ? JSON.stringify(photos) : null,
        amenities !== undefined ? JSON.stringify(amenities) : null,
        accepts_cash !== undefined ? !!accepts_cash : null,
        venueTax,
        cancelCutoff
      ]
    );

    const oldPhotos = Array.isArray(venue.photos) ? venue.photos : [];
    const newPhotos = Array.isArray(photos) ? photos : oldPhotos;
    for (const url of oldPhotos.filter((p) => !newPhotos.includes(p))) {
      const objectName = storage.extractObjectName(url);
      if (objectName) {
        storage.deleteObject(objectName).catch((err) => {
          logger.error(`Failed to delete venue photo ${objectName}: ${err.message}`);
        });
      }
    }

    ok(res, 200, updated[0]);
  } catch (error) {
    logger.error(`Error updating venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.resubmitVenue = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: venueRows } = await pool.query(
      `select * from venues where id = $1`,
      [id]
    );
    if (venueRows.length === 0) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }
    const venue = venueRows[0];
    if (venue.owner_id !== req.user.id) {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this venue');
    }
    if (!['changes_requested', 'rejected'].includes(venue.status)) {
      return fail(res, 400, 'VENUE_NOT_IN_REQUIRED_STATE', 'Only rejected or changes-requested venues can be resubmitted');
    }

    const { rows: updated } = await pool.query(
      `update venues set status = 'pending', rejection_reason = null, updated_at = now()
       where id = $1
       returning *`,
      [id]
    );

    ok(res, 200, updated[0]);
  } catch (error) {
    logger.error(`Error resubmitting venue: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

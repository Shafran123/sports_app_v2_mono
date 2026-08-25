// Owner-side venue configuration for the venue-hours/pricing/offers feature
// set: advance horizon, closed dates, variable pricing rules, and offers.
// Every handler verifies venue ownership before touching a row.

const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { rawWindowsForDay } = require('../services/venueEngine');

async function verifyOwnership(client, venueId, userId) {
  const { rows } = await client.query(
    `select owner_id from venues where id = $1`,
    [venueId]
  );
  if (rows.length === 0) {
    return { error: { status: 404, code: 'VENUE_NOT_FOUND', message: 'Venue not found' } };
  }
  if (rows[0].owner_id !== userId) {
    return { error: { status: 403, code: 'FORBIDDEN', message: 'You do not own this venue' } };
  }
  return {};
}

async function courtVenueId(client, courtId) {
  const { rows } = await client.query(
    `select venue_id from courts where id = $1`,
    [courtId]
  );
  return rows.length ? rows[0].venue_id : null;
}

function isDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isValidTime(str) {
  return typeof str === 'string' && /^\d{2}:\d{2}$/.test(str);
}

// True when a pricing/offer window (start–end on dayOfWeek) fits inside at
// least one Opening Window of that weekday. null dayOfWeek = any day, so it
// must fit inside at least one weekday's windows (best-effort union).
async function windowFits(client, venueId, dayOfWeek, start, end) {
  const days = dayOfWeek === null ? [0, 1, 2, 3, 4, 5, 6] : [dayOfWeek];
  for (const dow of days) {
    const windows = await rawWindowsForDay(client, venueId, sampleDateForDow(dow));
    if (windows.some((w) => start >= w.open_time && end <= w.close_time)) return true;
  }
  return false;
}

// A concrete YYYY-MM-DD for a weekday index (next occurrence, so windowsForDay
// sees the right weekday without colliding with a Closed Date).
function sampleDateForDow(dow) {
  const d = new Date();
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

exports.updateAdvanceDays = async (req, res) => {
  try {
    const { id } = req.params;
    const days = Number(req.body.advance_days);
    if (!Number.isInteger(days) || days < 0) {
      return fail(res, 400, 'ADVANCE_DAYS_VALIDATION', 'advance_days must be a whole number of days (0 = unlimited)');
    }
    const ownership = await verifyOwnership(pool, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(
      `update venues set advance_days = $2, updated_at = now() where id = $1 returning id, advance_days`,
      [id, days]
    );
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error updating advance days: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.listClosedDates = async (req, res) => {
  try {
    const { id } = req.params;
    const ownership = await verifyOwnership(pool, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(
      `select closed_date, reason from venue_closed_dates where venue_id = $1 order by closed_date desc`,
      [id]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing closed dates: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.addClosedDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { closed_date, reason } = req.body;
    if (!isDate(closed_date)) {
      return fail(res, 400, 'CLOSED_DATE_VALIDATION', 'closed_date is required (YYYY-MM-DD)');
    }
    if (closed_date < new Date().toISOString().slice(0, 10)) {
      return fail(res, 400, 'CLOSED_DATE_VALIDATION', 'closed_date must be today or later');
    }
    const ownership = await verifyOwnership(pool, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(
      `insert into venue_closed_dates (venue_id, closed_date, reason) values ($1, $2, $3)
       on conflict (venue_id, closed_date) do update set reason = excluded.reason
       returning closed_date, reason`,
      [id, closed_date, reason || null]
    );
    ok(res, 201, rows[0]);
  } catch (error) {
    logger.error(`Error adding closed date: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.removeClosedDate = async (req, res) => {
  try {
    const { id, closedDate } = req.params;
    if (!isDate(closedDate)) {
      return fail(res, 400, 'CLOSED_DATE_VALIDATION', 'closed_date is required (YYYY-MM-DD)');
    }
    const ownership = await verifyOwnership(pool, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(
      `delete from venue_closed_dates where venue_id = $1 and closed_date = $2 returning id`,
      [id, closedDate]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'CLOSED_DATE_NOT_FOUND', 'Closed date not found');
    }
    ok(res, 200, { removed: closedDate });
  } catch (error) {
    logger.error(`Error removing closed date: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.listPricingRules = async (req, res) => {
  try {
    const { id } = req.params;
    const venueId = await courtVenueId(pool, id);
    if (!venueId) return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    const ownership = await verifyOwnership(pool, venueId, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(
      `select id, day_of_week, start_time, end_time, price_per_slot
       from court_pricing_rules where court_id = $1 order by day_of_week nulls first, start_time`,
      [id]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing pricing rules: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.addPricingRule = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { day_of_week, start_time, end_time, price_per_slot } = req.body;

    if (day_of_week !== null && day_of_week !== undefined && (!Number.isInteger(Number(day_of_week)) || day_of_week < 0 || day_of_week > 6)) {
      return fail(res, 400, 'PRICING_VALIDATION', 'day_of_week must be 0-6 or null for any day');
    }
    if (!isValidTime(start_time) || !isValidTime(end_time) || end_time <= start_time) {
      return fail(res, 400, 'PRICING_VALIDATION', 'start_time and end_time are required and end must be after start');
    }
    const price = Number(price_per_slot);
    if (!Number.isInteger(price) || price < 0) {
      return fail(res, 400, 'PRICING_VALIDATION', 'price_per_slot must be a whole number of LKR');
    }
    const venueId = await courtVenueId(client, id);
    if (!venueId) return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    const ownership = await verifyOwnership(client, venueId, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const dow = day_of_week === null || day_of_week === undefined ? null : Number(day_of_week);
    if (!(await windowFits(client, venueId, dow, start_time, end_time))) {
      return fail(res, 400, 'PRICING_VALIDATION', 'A pricing window must fit inside an opening window');
    }

    const { rows } = await client.query(
      `insert into court_pricing_rules (court_id, day_of_week, start_time, end_time, price_per_slot)
       values ($1, $2, $3, $4, $5) returning *`,
      [id, dow, start_time, end_time, price]
    );
    ok(res, 201, rows[0]);
  } catch (error) {
    logger.error(`Error adding pricing rule: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

// Replace a court's whole pricing schedule in one transaction: delete all
// existing rules and insert the new ones. An empty `rules` array returns the
// court to its flat base price. Each rule goes through the same validation as
// addPricingRule (day range, valid times, whole LKR, window must fit inside an
// opening window).
exports.replacePricingRules = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return fail(res, 400, 'PRICING_VALIDATION', 'rules must be an array');
    }

    const venueId = await courtVenueId(client, id);
    if (!venueId) return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    const ownership = await verifyOwnership(client, venueId, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const normalized = [];
    for (const r of rules) {
      const { day_of_week, start_time, end_time, price_per_slot } = r;
      if (day_of_week !== null && day_of_week !== undefined && (!Number.isInteger(Number(day_of_week)) || day_of_week < 0 || day_of_week > 6)) {
        return fail(res, 400, 'PRICING_VALIDATION', 'day_of_week must be 0-6 or null for any day');
      }
      if (!isValidTime(start_time) || !isValidTime(end_time) || end_time <= start_time) {
        return fail(res, 400, 'PRICING_VALIDATION', 'start_time and end_time are required and end must be after start');
      }
      const price = Number(price_per_slot);
      if (!Number.isInteger(price) || price < 0) {
        return fail(res, 400, 'PRICING_VALIDATION', 'price_per_slot must be a whole number of LKR');
      }
      const dow = day_of_week === null || day_of_week === undefined ? null : Number(day_of_week);
      if (!(await windowFits(client, venueId, dow, start_time, end_time))) {
        return fail(res, 400, 'PRICING_VALIDATION', 'A pricing window must fit inside an opening window');
      }
      normalized.push({ day_of_week: dow, start_time, end_time, price_per_slot: price });
    }

    await client.query('begin');
    await client.query(`delete from court_pricing_rules where court_id = $1`, [id]);
    for (const r of normalized) {
      await client.query(
        `insert into court_pricing_rules (court_id, day_of_week, start_time, end_time, price_per_slot)
         values ($1, $2, $3, $4, $5)`,
        [id, r.day_of_week, r.start_time, r.end_time, r.price_per_slot]
      );
    }
    await client.query('commit');

    const { rows } = await client.query(
      `select id, day_of_week, start_time, end_time, price_per_slot
       from court_pricing_rules where court_id = $1 order by day_of_week nulls first, start_time`,
      [id]
    );
    ok(res, 200, rows);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error replacing pricing rules: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.deletePricingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: ruleRows } = await pool.query(
      `select court_id from court_pricing_rules where id = $1`,
      [id]
    );
    if (ruleRows.length === 0) return fail(res, 404, 'PRICING_RULE_NOT_FOUND', 'Pricing rule not found');
    const venueId = await courtVenueId(pool, ruleRows[0].court_id);
    if (!venueId) return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    const ownership = await verifyOwnership(pool, venueId, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(`delete from court_pricing_rules where id = $1 returning id`, [id]);
    ok(res, 200, { id: rows[0].id });
  } catch (error) {
    logger.error(`Error deleting pricing rule: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

async function loadOffer(client, offerId, venueId) {
  const { rows } = await client.query(
    `select * from offers where id = $1 and venue_id = $2`,
    [offerId, venueId]
  );
  if (rows.length === 0) return null;
  const offer = rows[0];
  const { rows: scopes } = await client.query(
    `select court_id from offer_scopes where offer_id = $1`,
    [offerId]
  );
  const { rows: windows } = await client.query(
    `select day_of_week, start_time, end_time from offer_windows where offer_id = $1 order by day_of_week, start_time`,
    [offerId]
  );
  return { ...offer, scopes: scopes.map((s) => s.court_id), windows };
}

exports.listOffers = async (req, res) => {
  try {
    const { id } = req.params;
    const ownership = await verifyOwnership(pool, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    const { rows } = await pool.query(
      `select id from offers where venue_id = $1 order by created_at desc`,
      [id]
    );
    const offers = [];
    for (const row of rows) {
      offers.push(await loadOffer(pool, row.id, id));
    }
    ok(res, 200, offers);
  } catch (error) {
    logger.error(`Error listing offers: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.createOffer = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { kind, discount_type, percent, flat_amount, start_date, end_date, scopes, windows } = req.body;

    if (!['venue', 'slot'].includes(kind)) {
      return fail(res, 400, 'OFFER_VALIDATION', 'kind must be venue or slot');
    }
    if (!['percent', 'flat'].includes(discount_type)) {
      return fail(res, 400, 'OFFER_VALIDATION', 'discount_type must be percent or flat');
    }
    const percentValue = discount_type === 'percent' ? Number(percent) : null;
    const flatValue = discount_type === 'flat' ? Number(flat_amount) : null;
    if (discount_type === 'percent' && (!Number.isInteger(percentValue) || percentValue < 0 || percentValue > 100)) {
      return fail(res, 400, 'OFFER_VALIDATION', 'percent must be a whole number 0-100');
    }
    if (discount_type === 'flat' && (!Number.isInteger(flatValue) || flatValue < 0)) {
      return fail(res, 400, 'OFFER_VALIDATION', 'flat_amount must be a whole number of LKR');
    }
    if (start_date !== undefined && start_date !== null && !isDate(start_date)) {
      return fail(res, 400, 'OFFER_VALIDATION', 'start_date must be YYYY-MM-DD');
    }
    if (end_date !== undefined && end_date !== null && !isDate(end_date)) {
      return fail(res, 400, 'OFFER_VALIDATION', 'end_date must be YYYY-MM-DD');
    }
    if (start_date && end_date && end_date < start_date) {
      return fail(res, 400, 'OFFER_VALIDATION', 'end_date must be on or after start_date');
    }

    const ownership = await verifyOwnership(client, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const { rows: courtRows } = await client.query(
      `select id from courts where venue_id = $1`,
      [id]
    );
    const venueCourtIds = new Set(courtRows.map((c) => c.id));

    // Validate scopes belong to this venue.
    if (scopes && scopes.length > 0) {
      for (const courtId of scopes) {
        if (!venueCourtIds.has(courtId)) {
          return fail(res, 400, 'OFFER_VALIDATION', 'An offer scope must be a court of this venue');
        }
      }
    }

    await client.query('begin');
    const { rows } = await client.query(
      `insert into offers (venue_id, kind, discount_type, percent, flat_amount, is_active, start_date, end_date)
       values ($1, $2, $3, $4, $5, true, $6, $7)
       returning *`,
      [id, kind, discount_type, percentValue, flatValue, start_date || null, end_date || null]
    );
    const offer = rows[0];

    if (kind === 'slot') {
      for (const courtId of scopes || []) {
        await client.query(
          `insert into offer_scopes (offer_id, court_id) values ($1, $2)`,
          [offer.id, courtId]
        );
      }
      for (const window of windows || []) {
        const { day_of_week, start_time, end_time } = window;
        if (!isValidTime(start_time) || !isValidTime(end_time) || end_time <= start_time) {
          await client.query('rollback').catch(() => {});
          return fail(res, 400, 'OFFER_VALIDATION', 'Each offer window needs a valid day_of_week, start_time, end_time');
        }
        const dow = day_of_week === null || day_of_week === undefined ? null : Number(day_of_week);
        if (!(await windowFits(client, id, dow, start_time, end_time))) {
          await client.query('rollback').catch(() => {});
          return fail(res, 400, 'OFFER_VALIDATION', 'An offer window must fit inside an opening window');
        }
        await client.query(
          `insert into offer_windows (offer_id, day_of_week, start_time, end_time) values ($1, $2, $3, $4)`,
          [offer.id, dow, start_time, end_time]
        );
      }
    }

    await client.query('commit');
    ok(res, 201, await loadOffer(client, offer.id, id));
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error creating offer: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.updateOffer = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { is_active, start_date, end_date } = req.body;

    const { rows: offerRows } = await client.query(
      `select venue_id from offers where id = $1`,
      [id]
    );
    if (offerRows.length === 0) return fail(res, 404, 'OFFER_NOT_FOUND', 'Offer not found');
    const ownership = await verifyOwnership(client, offerRows[0].venue_id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const { rows } = await client.query(
      `update offers set
         is_active = coalesce($2, is_active),
         start_date = coalesce($3, start_date),
         end_date = coalesce($4, end_date)
       where id = $1
       returning *`,
      [id, is_active !== undefined ? !!is_active : null, start_date ?? null, end_date ?? null]
    );
    ok(res, 200, await loadOffer(client, rows[0].id, offerRows[0].venue_id));
  } catch (error) {
    logger.error(`Error updating offer: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: offerRows } = await pool.query(
      `select venue_id from offers where id = $1`,
      [id]
    );
    if (offerRows.length === 0) return fail(res, 404, 'OFFER_NOT_FOUND', 'Offer not found');
    const ownership = await verifyOwnership(pool, offerRows[0].venue_id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }
    await pool.query(`delete from offers where id = $1`, [id]);
    ok(res, 200, { id });
  } catch (error) {
    logger.error(`Error deleting offer: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};
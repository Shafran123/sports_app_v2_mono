const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { publishBookingEvent } = require('../utils/publish');
const notificationCatalog = require('../utils/notificationCatalog');
const { stripBookingSecrets, stripBookingSecretsList } = require('../utils/scrub');
const cancellationService = require('../services/cancellation');
const { mintQrToken } = require('../utils/tokens');
const billService = require('../utils/billService');
const { getTaxRate, applyInclusiveTax } = require('../utils/featureFlags');
const { colomboDate, colomboTime } = require('../utils/colombo');
const { windowsForDay } = require('../services/venueEngine');
const pricingEngine = require('../services/pricingEngine');

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
  return { ownerId: rows[0].owner_id };
}

exports.listCourts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select c.*, v.name as venue_name, s.name as sport_name, s.slug as sport_slug
       from courts c
       join venues v on v.id = c.venue_id
       left join sports s on s.id = c.sport_id
       where v.owner_id = $1
       order by c.created_at desc`,
      [req.user.id]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing courts: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.createCourt = async (req, res) => {
  const client = await pool.connect();
  try {
    const { venue_id, name, sport, price_per_slot, slot_duration_min, capacity, is_indoor } = req.body;

    if (!venue_id || !name || price_per_slot === undefined || !sport) {
      return fail(res, 400, 'COURT_VALIDATION', 'venue_id, name, sport, and price_per_slot are required');
    }

    const ownership = await verifyOwnership(client, venue_id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const { rows: sportRows } = await client.query(
      `select id from sports where slug = $1`,
      [sport]
    );
    if (sportRows.length === 0) {
      return fail(res, 400, 'COURT_VALIDATION', `Unknown sport: ${sport}`);
    }

    const { rows } = await client.query(
      `insert into courts (venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        venue_id, sportRows[0].id, name,
        capacity || null, price_per_slot,
        slot_duration_min || 60, !!is_indoor
      ]
    );

    ok(res, 201, rows[0]);
  } catch (error) {
    logger.error(`Error creating court: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.updateCourt = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, price_per_slot, slot_duration_min, capacity, is_indoor, is_active } = req.body;

    const { rows: courtRows } = await client.query(
      `select * from courts where id = $1`,
      [id]
    );
    if (courtRows.length === 0) {
      return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    }
    const court = courtRows[0];

    const ownership = await verifyOwnership(client, court.venue_id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const { rows } = await client.query(
      `update courts set
         name = coalesce($2, name),
         price_per_slot = coalesce($3, price_per_slot),
         slot_duration_min = coalesce($4, slot_duration_min),
         capacity = coalesce($5, capacity),
         is_indoor = coalesce($6, is_indoor),
         is_active = coalesce($7, is_active),
         updated_at = now()
       where id = $1
       returning *`,
      [
        id,
        name ?? null,
        price_per_slot ?? null,
        slot_duration_min ?? null,
        capacity ?? null,
        is_indoor ?? null,
        is_active ?? null
      ]
    );

    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error updating court: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.updateVenueHours = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { hours } = req.body;

    if (!Array.isArray(hours)) {
      return fail(res, 400, 'HOURS_VALIDATION', 'hours must be an array');
    }

    // Each row is one Opening Window. A day may have several windows, but they
    // must not overlap and each must be a valid open < close pair.
    const byDay = {};
    for (const hour of hours) {
      const day = Number(hour.day_of_week);
      if (!Number.isInteger(day) || day < 0 || day > 6 || !hour.open_time || !hour.close_time) {
        return fail(res, 400, 'HOURS_VALIDATION', 'Each hour needs day_of_week (0-6), open_time, close_time');
      }
      if (hour.close_time <= hour.open_time) {
        return fail(res, 400, 'HOURS_VALIDATION', 'Close time must be after open time');
      }
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({ open: hour.open_time, close: hour.close_time });
    }
    for (const day of Object.keys(byDay)) {
      const windows = byDay[day].sort((a, b) => (a.open > b.open ? 1 : -1));
      for (let i = 1; i < windows.length; i++) {
        if (windows[i].open < windows[i - 1].close) {
          return fail(res, 400, 'HOURS_VALIDATION', 'Opening windows on the same day must not overlap');
        }
      }
    }

    const ownership = await verifyOwnership(client, id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    await client.query('begin');
    await client.query(`delete from venue_hours where venue_id = $1`, [id]);
    for (const hour of hours) {
      await client.query(
        `insert into venue_hours (venue_id, day_of_week, open_time, close_time)
         values ($1, $2, $3, $4)`,
        [id, hour.day_of_week, hour.open_time, hour.close_time]
      );
    }
    await client.query('commit');

    const { rows } = await client.query(
      `select day_of_week, open_time, close_time from venue_hours where venue_id = $1 order by day_of_week`,
      [id]
    );

    ok(res, 200, { hours: rows });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error updating venue hours: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.createBlock = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { start_at, end_at, reason } = req.body;

    if (!start_at || !end_at || new Date(end_at) <= new Date(start_at)) {
      return fail(res, 400, 'BLOCK_VALIDATION', 'start_at and end_at are required and end_at must be after start_at');
    }

    const { rows: courtRows } = await client.query(
      `select venue_id from courts where id = $1`,
      [id]
    );
    if (courtRows.length === 0) {
      return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    }

    const ownership = await verifyOwnership(client, courtRows[0].venue_id, req.user.id);
    if (ownership.error) {
      return fail(res, ownership.error.status, ownership.error.code, ownership.error.message);
    }

    const { rows } = await client.query(
      `insert into blocks (court_id, start_at, end_at, reason)
       values ($1, $2, $3, $4)
       returning *`,
      [id, start_at, end_at, reason || null]
    );

    ok(res, 201, rows[0]);
  } catch (error) {
    logger.error(`Error creating block: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.listBlocks = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `select b.* from blocks b
       join courts c on c.id = b.court_id
       where b.court_id = $1 and c.venue_id in (select id from venues where owner_id = $2)
       order by b.start_at`,
      [id, req.user.id]
    );

    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing blocks: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.deleteBlock = async (req, res) => {
  try {
    const { id, blockId } = req.params;

    const { rows } = await pool.query(
      `delete from blocks b
       using courts c, venues v
       where b.id = $1 and b.court_id = $2
         and c.id = b.court_id and v.id = c.venue_id and v.owner_id = $3
       returning b.id`,
      [blockId, id, req.user.id]
    );

    if (rows.length === 0) {
      return fail(res, 404, 'BLOCK_NOT_FOUND', 'Block not found');
    }

    ok(res, 200, { id: rows[0].id });
  } catch (error) {
    logger.error(`Error deleting block: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.listBookings = async (req, res) => {
  try {
    const { date, date_from, date_to, status, venue_id, sport, page = 1, limit = 20 } = req.query;

    const conditions = [`v.owner_id = $1`];
    const values = [req.user.id];
    let index = 2;

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      conditions.push(`b.start_at >= $${index++} and b.start_at < $${index++}`);
      values.push(`${date}T00:00:00+05:30`, `${date}T23:59:59+05:30`);
    } else {
      if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
        conditions.push(`b.start_at >= $${index++}`);
        values.push(`${date_from}T00:00:00+05:30`);
      }
      if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
        conditions.push(`b.start_at < $${index++}`);
        values.push(`${date_to}T23:59:59+05:30`);
      }
    }
    if (status && /^[a-z_]+$/.test(status)) {
      conditions.push(`b.status = $${index++}`);
      values.push(status);
    }
    if (venue_id && /^[0-9a-f-]{36}$/.test(venue_id)) {
      conditions.push(`v.id = $${index++}`);
      values.push(venue_id);
    }
    if (sport && /^[a-z0-9-]+$/.test(sport)) {
      conditions.push(`exists (select 1 from sports sp where sp.id = c.sport_id and sp.slug = $${index++})`);
      values.push(sport);
    }

    const where = conditions.join(' and ');
    const offset = (Number(page) - 1) * Number(limit);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `select b.*, c.name as court_name, v.name as venue_name, s.name as sport,
                u.name as player_name, u.phone as player_phone,
                (select p.status from payments p where p.booking_id = b.id and p.payment_method = 'cash' order by p.created_at desc limit 1) as cash_payment_status,
                (select p.paid_at from payments p where p.booking_id = b.id and p.payment_method = 'cash' order by p.created_at desc limit 1) as paid_at
         from bookings b
         join courts c on c.id = b.court_id
         join venues v on v.id = c.venue_id
         left join sports s on s.id = c.sport_id
         left join users u on u.id = b.user_id
         where ${where}
         order by b.start_at desc
         limit $${index++} offset $${index}`,
        [...values, Number(limit), offset]
      ),
      pool.query(
        `select count(*)::int as total
         from bookings b
         join courts c on c.id = b.court_id
         join venues v on v.id = c.venue_id
         where ${where}`,
        values
      )
    ]);

    // The QR token is disclosed only through the scan flow (where the venue
    // presents the token it just scanned) — never through list/read APIs.
    stripBookingSecretsList(rows);

    ok(res, 200, rows, { page: Number(page), limit: Number(limit), total: countRows[0].total });
  } catch (error) {
    logger.error(`Error listing business bookings: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Check-in is allowed from booking creation (walk-ins arrive early) until the
// slot ends plus a short grace window. Earlier code required ±30min around the
// slot, which blocked early arrivals.
function checkInWindow(booking, now = new Date()) {
  const created = new Date(booking.created_at);
  const graceEnd = new Date(new Date(booking.end_at).getTime() + 30 * 60000);
  return now >= created && now <= graceEnd;
}

async function findOwnedBooking(req, whereClause, params) {
  const { rows } = await pool.query(
    `select b.*, c.venue_id, v.owner_id, v.name as venue_name, c.name as court_name, u.name as player_user_name
     from bookings b
     join courts c on c.id = b.court_id
     join venues v on v.id = c.venue_id
     left join users u on u.id = b.user_id
     where ${whereClause}`,
    params
  );
  if (rows.length === 0) {
    return { notFound: true };
  }
  const booking = rows[0];
  if (booking.owner_id !== req.user.id && req.user.role !== 'admin') {
    return { forbidden: true };
  }
  return { booking };
}

exports.qrLookup = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return fail(res, 400, 'TOKEN_REQUIRED', 'A QR token is required');
    }

    const result = await findOwnedBooking(req, 'b.qr_token = $1', [token]);
    if (result.notFound) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (result.forbidden) {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this venue');
    }

    // Read-only lookup: returns details without consuming the token.
    ok(res, 200, result.booking);
  } catch (error) {
    logger.error(`Error looking up booking by QR: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.qrCheckIn = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return fail(res, 400, 'TOKEN_REQUIRED', 'A QR token is required');
    }

    const result = await findOwnedBooking(req, 'b.qr_token = $1', [token]);
    if (result.notFound) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (result.forbidden) {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this venue');
    }
    const booking = result.booking;

    if (booking.status !== 'confirmed') {
      const used = ['checked_in', 'completed', 'no_show'].includes(booking.status);
      return fail(res, 409, used ? 'QR_ALREADY_USED' : 'CHECK_IN_INVALID_STATE', used ? 'This QR code has already been used' : 'This booking cannot be checked in');
    }

    if (!checkInWindow(booking)) {
      return fail(res, 409, 'CHECK_IN_WINDOW_VIOLATION', 'Check-in is only allowed from booking creation until shortly after the slot');
    }

    const { rows } = await pool.query(
      `update bookings set status = 'checked_in', checked_in_at = now(), updated_at = now()
       where id = $1 and status = 'confirmed'
       returning *`,
      [booking.id]
    );

    await publishBookingEvent('booking.checked_in', booking.id);

    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error checking in by QR: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.markPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await findOwnedBooking(req, 'b.id = $1', [id]);
    if (result.notFound) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    if (result.forbidden) {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this venue');
    }
    const booking = result.booking;

    if (booking.payment_method !== 'cash') {
      return fail(res, 400, 'NOT_CASH_BOOKING', 'Only cash bookings can be marked paid');
    }

    const { rows: existing } = await pool.query(
      `select * from payments where booking_id = $1 and payment_method = 'cash' and status = 'paid' limit 1`,
      [id]
    );
    if (existing.length > 0) {
      return ok(res, 200, existing[0]);
    }

    const { rows: inserted } = await pool.query(
      `insert into payments (user_id, booking_id, amount, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, currency, status, payment_method, paid_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'LKR', 'paid', 'cash', now())
       returning *`,
      [booking.user_id, booking.id, booking.total_price, booking.tax_rate, booking.tax_amount, booking.venue_tax_rate, booking.venue_tax_amount]
    );

    await publishBookingEvent('booking.marked_paid', booking.id);
    void billService.emailBillForBooking(booking.id);

    ok(res, 200, inserted[0]);
  } catch (error) {
    logger.error(`Error marking booking paid: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

const OWNER_RANGES = { 7: 7, 30: 30, 90: 90 };

// Same window definition as the admin reports: paid payments from `days`
// days ago (Asia/Colombo boundaries, no DST) forward.
function ownerWindowStart(days) {
  const d = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  const iso = d.toISOString().slice(0, 10);
  const start = new Date(`${iso}T00:00:00+05:30`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString();
}

// Owner-scoped reports for the dashboard charts: time series, by-sport,
// by-venue and payment split for the owner's venues (optionally one venue).
exports.reports = async (req, res) => {
  try {
    const range = OWNER_RANGES[String(req.query.range || '7')] || 7;
    const since = ownerWindowStart(range);
    const venueId = req.query.venue_id && /^[0-9a-f-]{36}$/.test(req.query.venue_id) ? req.query.venue_id : null;

    const params = [since, req.user.id];
    const venueCond = venueId ? `and v.id = $3` : '';
    if (venueId) params.push(venueId);

    const { rows: series } = await pool.query(
      `select to_char((p.paid_at at time zone 'Asia/Colombo')::date, 'YYYY-MM-DD') as day,
              count(distinct p.booking_id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount - p.venue_tax_amount), 0)::int as revenue,
              coalesce(sum(p.tax_amount), 0)::int as tax,
              coalesce(sum(p.venue_tax_amount), 0)::int as venue_tax
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where p.status = 'paid' and p.paid_at >= $1 and v.owner_id = $2 ${venueCond}
       group by day
       order by day`,
      params
    );

    const { rows: bySport } = await pool.query(
      `select s.slug, s.name, count(distinct b.id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount - p.venue_tax_amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       left join sports s on s.id = c.sport_id
       where p.status = 'paid' and p.paid_at >= $1 and v.owner_id = $2 ${venueCond}
       group by s.slug, s.name
       order by revenue desc`,
      params
    );

    const { rows: byVenue } = await pool.query(
      `select v.id, v.name, count(distinct b.id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount - p.venue_tax_amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where p.status = 'paid' and p.paid_at >= $1 and v.owner_id = $2 ${venueCond}
       group by v.id, v.name
       order by revenue desc`,
      params
    );

    const { rows: split } = await pool.query(
      `select p.payment_method,
              count(distinct b.id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount - p.venue_tax_amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where p.status = 'paid' and p.paid_at >= $1 and v.owner_id = $2 ${venueCond}
       group by p.payment_method`,
      params
    );

    const { rows: events } = await pool.query(
      `select count(*) filter (where r.status in ('paid', 'pending'))::int as registrations,
              coalesce(sum(p.amount - p.tax_amount - p.venue_tax_amount) filter (where p.status = 'paid'), 0)::int as revenue
       from event_registrations r
       left join payments p on p.event_registration_id = r.id
       join events e on e.id = r.event_id
       where e.organizer_id = $1 and r.created_at >= $2`,
      [req.user.id, since]
    );

    ok(res, 200, {
      range,
      series,
      by_sport: bySport,
      by_venue: byVenue,
      payment_split: { online: split.find((s) => s.payment_method === 'online') || { bookings: 0, revenue: 0 }, cash: split.find((s) => s.payment_method === 'cash') || { bookings: 0, revenue: 0 } },
      events: events[0] ? { registrations: events[0].registrations, revenue: events[0].revenue } : { registrations: 0, revenue: 0 }
    });
  } catch (error) {
    logger.error(`Error fetching owner reports: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.overview = async (req, res) => {
  try {
    const { date } = req.query;

    const values = [req.user.id];
    let dayCondition = '';
    let index = 2;

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dayCondition = `and b.start_at >= $2 and b.start_at < $3`;
      values.push(`${date}T00:00:00+05:30`, `${date}T23:59:59+05:30`);
    }

    const { rows } = await pool.query(
      `select
         (select count(*)::int from bookings b
            join courts c on c.id = b.court_id
            join venues v on v.id = c.venue_id
            where v.owner_id = $1 and b.status in ('confirmed', 'checked_in', 'completed') ${dayCondition}) as bookings_count,
         coalesce(sum(p.amount), 0)::int as revenue,
         coalesce(sum(p.amount) filter (where p.payment_method = 'online'), 0)::int as online_revenue,
         coalesce(sum(p.amount) filter (where p.payment_method = 'cash'), 0)::int as cash_revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where v.owner_id = $1 and p.status = 'paid' ${dayCondition.replace('b.', 'b.')}`,
      values
    );

    const { rows: monthRows } = await pool.query(
      `select coalesce(sum(p.amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where v.owner_id = $1 and p.status = 'paid' and b.start_at >= date_trunc('month', now())`,
      [req.user.id]
    );

    ok(res, 200, { ...rows[0], month_revenue: monthRows[0].revenue, date: date || null });
  } catch (error) {
    logger.error(`Error fetching overview: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.cancelBooking = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: bookingRows } = await client.query(
      `select b.court_id from bookings b
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where b.id = $1 and v.owner_id = $2`,
      [req.params.id, req.user.id]
    );
    if (bookingRows.length === 0 && req.user.role !== 'admin') {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this booking');
    }

    await client.query('begin');
    const result = await cancellationService.cancelBooking(client, req.params.id, req.user.id, 'venue_owner');
    if (result.error) {
      await client.query('rollback');
      return fail(res, result.error.status, result.error.code, result.error.message);
    }
    await client.query('commit');
    await publishBookingEvent('booking.cancelled', req.params.id);
    const cancelKey = req.user.role === 'admin' ? 'booking.cancelled.admin' : 'booking.cancelled.owner';
    await notificationCatalog.dispatchBooking(cancelKey, req.params.id, {
      refund: { refund_amount: result.refund_amount, refund_pct: result.refund_pct }
    });
    ok(res, 200, result);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error cancelling business booking: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.markNoShow = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `update bookings b
       set status = 'no_show', updated_at = now()
       from courts c, venues v
       where b.id = $1 and b.court_id = c.id and c.venue_id = v.id and v.owner_id = $2
         and b.status = 'confirmed' and b.start_at < now()
       returning b.*`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return fail(res, 409, 'BOOKING_NOT_NO_SHOWABLE', 'Booking cannot be marked as no-show');
    }

    await publishBookingEvent('booking.no_show', req.params.id);

    ok(res, 200, stripBookingSecrets(rows[0]));
  } catch (error) {
    logger.error(`Error marking no-show: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.checkIn = async (req, res) => {
  try {
    const { rows: bookingRows } = await pool.query(
      `select b.*, c.venue_id from bookings b
       join courts c on c.id = b.court_id
       where b.id = $1`,
      [req.params.id]
    );

    if (bookingRows.length === 0) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    const booking = bookingRows[0];

    const { rows: venueRows } = await pool.query(
      `select owner_id from venues where id = $1`,
      [booking.venue_id]
    );
    if (venueRows.length === 0 || (venueRows[0].owner_id !== req.user.id && req.user.role !== 'admin')) {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this venue');
    }

    if (booking.status !== 'confirmed') {
      return fail(res, 409, 'CHECK_IN_INVALID_STATE', 'Only confirmed bookings can be checked in');
    }

    if (!checkInWindow(booking)) {
      return fail(res, 409, 'CHECK_IN_WINDOW_VIOLATION', 'Check-in is only allowed from booking creation until shortly after the slot');
    }

    const { rows } = await pool.query(
      `update bookings set status = 'checked_in', checked_in_at = now(), updated_at = now()
       where id = $1 and status = 'confirmed'
       returning *`,
      [req.params.id]
    );

    await publishBookingEvent('booking.checked_in', req.params.id);

    ok(res, 200, stripBookingSecrets(rows[0]));
  } catch (error) {
    logger.error(`Error checking in: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.createManualBooking = async (req, res) => {
  const client = await pool.connect();
  try {
    const { court_id, start_at, end_at, player_name, player_phone, amount } = req.body;

    if (!court_id || !start_at || !end_at) {
      return fail(res, 400, 'MANUAL_BOOKING_VALIDATION', 'court_id, start_at, and end_at are required');
    }

    const { rows: courtRows } = await client.query(
      `select c.*, v.owner_id, v.venue_tax_rate from courts c join venues v on v.id = c.venue_id where c.id = $1`,
      [court_id]
    );
    if (courtRows.length === 0) {
      return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    }
    const court = courtRows[0];
    if (court.owner_id !== req.user.id && req.user.role !== 'admin') {
      return fail(res, 403, 'FORBIDDEN', 'You do not manage this court');
    }

    // Walk-ins use the same pricing engine as players: the server derives the
    // authoritative total from variable pricing + offers and rejects a client
    // amount that drifts from it (one pricing path everywhere).
    const start = new Date(start_at);
    const end = new Date(end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return fail(res, 400, 'MANUAL_BOOKING_VALIDATION', 'Invalid time range');
    }
    const localDate = colomboDate(start_at);
    const windows = await windowsForDay(client, court.venue_id, localDate);
    if (windows.length === 0) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'The venue is closed on this date');
    }
    const slotStart = colomboTime(start_at);
    const slotEnd = colomboTime(end_at);
    if (!windows.some((w) => slotStart >= w.open_time && slotEnd <= w.close_time)) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'This booking must fit inside one opening window');
    }

    const pricing = await pricingEngine.computePricing(client, court, start_at, end_at);
    const total = pricing.total;
    if (amount !== undefined && Number(amount) !== total) {
      return fail(res, 409, 'PRICE_DRIFT', `The price for this slot is ${total}; refresh and try again`);
    }

    await client.query('begin');
    await client.query('savepoint manual_insert');
    try {
      // The derived total is the amount the walk-in pays; the platform and
      // venue taxes are derived server-side from it (inclusive math, ADR-0021)
      // and snapshotted like any booking.
      const platformRate = await getTaxRate();
      const split = applyInclusiveTax(total, platformRate, court.venue_tax_rate || 0);
      const { rows } = await client.query(
        `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, status, payment_method, player_name, player_phone, qr_token, idempotency_key, subtotal_amount, discount_amount)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', 'cash', $11, $12, $13, $14, $15, $16)
         returning *`,
        [
          court_id, req.user.id, start_at, end_at,
          pricing.slots[0]?.base_price ?? court.price_per_slot, total, split.platformRate, split.platformTax, split.venueRate, split.venueTax, player_name || null, player_phone || null,
          mintQrToken(),
          `manual-${Math.random().toString(36).slice(2)}`,
          pricing.subtotal, pricing.discount
        ]
      );
      await client.query('commit');
      const created = rows[0];
      await publishBookingEvent('booking.created', created.id);
      await notificationCatalog.dispatchBooking('booking.walkin_created', created.id);
      ok(res, 201, created);
    } catch (error) {
      await client.query('rollback to savepoint manual_insert');
      if (error.code === '23505' || error.code === '23P01') {
        return fail(res, 409, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is already taken');
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Error creating manual booking: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

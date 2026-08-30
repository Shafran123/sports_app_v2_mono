const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { buildCheckoutParams } = require('../utils/payhere');
const { requestBaseUrl } = require('../utils/tokens');
const { getFlag, getTaxRate, getVenueTaxRate, applyInclusiveTax } = require('../utils/featureFlags');
const billService = require('../utils/billService');
const notificationCatalog = require('../utils/notificationCatalog');

// Players only ever see Events when discovery state is 'enabled' — or the
// teaser surface when 'coming_soon'. 'hidden' removes the section entirely.
const PLAYER_VISIBLE_STATES = ['enabled', 'coming_soon'];

exports.listEvents = async (req, res) => {
  try {
    const discovery = await getFlag('events_discovery_state');
    if (discovery === 'hidden') {
      return ok(res, 200, []);
    }

    const { city, sport, page = 1, limit = 20 } = req.query;
    const conditions = [`e.status = 'active' and e.start_at > now()`];
    const values = [];
    let index = 1;

    if (city) {
      conditions.push(`e.city ilike $${index++}`);
      values.push(`%${city}%`);
    }
    if (sport) {
      conditions.push(`s.slug = $${index++}`);
      values.push(sport);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { rows } = await pool.query(
      `select e.*, s.name as sport_name, s.slug as sport_slug, v.name as venue_name,
              (select count(*)::int from event_registrations r where r.event_id = e.id and r.status in ('pending', 'paid')) as registrations_count
       from events e
       left join sports s on s.id = e.sport_id
       left join venues v on v.id = e.venue_id
       where ${conditions.join(' and ')}
       order by e.start_at
       limit $${index++} offset $${index}`,
      [...values, Number(limit), offset]
    );
    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing events: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.getEvent = async (req, res) => {
  try {
    const discovery = await getFlag('events_discovery_state');
    const { rows } = await pool.query(
      `select e.*, s.name as sport_name, s.slug as sport_slug, v.name as venue_name,
              (select count(*)::int from event_registrations r where r.event_id = e.id and r.status in ('pending', 'paid')) as registrations_count
       from events e
       left join sports s on s.id = e.sport_id
       left join venues v on v.id = e.venue_id
       where e.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found');
    }
    if (!PLAYER_VISIBLE_STATES.includes(discovery) && rows[0].organizer_id !== req.user?.id) {
      return fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found');
    }
    ok(res, 200, rows[0]);
  } catch (error) {
    logger.error(`Error fetching event: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { name, description, sport, venue_id, start_at, end_at, city, capacity, price, image_url } = req.body;

    if (!name || !start_at || !capacity || price === undefined) {
      return fail(res, 400, 'EVENT_VALIDATION', 'name, start_at, capacity, and price are required');
    }

    const { rows: sportRows } = await pool.query(`select id from sports where slug = $1`, [sport]);

    const { rows } = await pool.query(
      `insert into events (organizer_id, venue_id, sport_id, name, description, start_at, end_at, city, capacity, price, image_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [
        req.user.id,
        venue_id || null,
        sportRows.length ? sportRows[0].id : null,
        name,
        description || null,
        start_at,
        end_at || null,
        city || null,
        capacity,
        price,
        image_url || null
      ]
    );
    ok(res, 201, rows[0]);
  } catch (error) {
    logger.error(`Error creating event: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.cancelEvent = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows } = await client.query(
      `update events set status = 'cancelled' where id = $1 and organizer_id = $2 returning *`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0 && req.user.role !== 'admin') {
      await client.query('rollback');
      return fail(res, 403, 'FORBIDDEN', 'Only the organizer or an admin can cancel this event');
    }
    if (rows.length === 0) {
      const adminRows = await client.query(
        `update events set status = 'cancelled' where id = $1 returning *`,
        [req.params.id]
      );
      if (adminRows.rows.length === 0) {
        await client.query('rollback');
        return fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found');
      }
    }

    await client.query(
      `update event_registrations set status = 'refunded' where event_id = $1 and status in ('pending', 'paid')`,
      [req.params.id]
    );
    await client.query(
      `update payments set needs_manual_refund = true
       where event_registration_id in (
         select id from event_registrations where event_id = $1 and status = 'refunded'
       ) and status = 'paid'`,
      [req.params.id]
    );

    await client.query('commit');
    await notificationCatalog.dispatchEventCancelled(req.params.id);
    ok(res, 200, { cancelled: true, event_id: req.params.id });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error cancelling event: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.registerForEvent = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { idempotency_key } = req.body;

    const [discovery, taxRate] = await Promise.all([getFlag('events_discovery_state'), getTaxRate()]);
    if (discovery !== 'enabled') {
      return fail(res, 409, 'EVENTS_NOT_AVAILABLE', 'Event registration is temporarily unavailable.');
    }

    await client.query('begin');

    const { rows: eventRows } = await client.query(
      `select * from events where id = $1 and status = 'active' for update`,
      [id]
    );
    if (eventRows.length === 0) {
      await client.query('rollback');
      return fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found');
    }
    const event = eventRows[0];

    if (event.start_at <= new Date()) {
      await client.query('rollback');
      return fail(res, 400, 'EVENT_CLOSED', 'This event has already started');
    }

    const { rows: countRows } = await client.query(
      `select count(*)::int as n from event_registrations where event_id = $1 and status in ('pending', 'paid')`,
      [id]
    );
    if (countRows[0].n >= event.capacity) {
      await client.query('rollback');
      return fail(res, 409, 'EVENT_FULL', 'This event is full');
    }

    const { rows: existing } = await client.query(
      `select * from event_registrations where event_id = $1 and user_id = $2 and status in ('pending', 'paid')`,
      [id, req.user.id]
    );
    if (existing.length > 0) {
      await client.query('rollback');
      return fail(res, 409, 'ALREADY_REGISTERED', 'You are already registered for this event');
    }

    // Inclusive pricing (ADR-0021): the event price is the total the player
    // pays; platform + venue taxes are carved out and snapshotted.
    const venueTaxRate = await getVenueTaxRate(event.venue_id);
    const taxed = applyInclusiveTax(event.price, taxRate, venueTaxRate);

    const { rows: regRows } = await client.query(
      `insert into event_registrations (event_id, user_id, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, status)
       values ($1, $2, $3, $4, $5, $6, 'pending')
       returning *`,
      [id, req.user.id, taxed.platformRate, taxed.platformTax, taxed.venueRate, taxed.venueTax]
    );
    const registration = regRows[0];

    await client.query(
      `insert into payments (user_id, event_registration_id, payhere_payment_id, amount, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, currency, status, payment_method)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'LKR', 'pending', 'payhere')`,
      [req.user.id, registration.id, registration.id, taxed.total, taxed.platformRate, taxed.platformTax, taxed.venueRate, taxed.venueTax]
    );

    await client.query('commit');

    await notificationCatalog.dispatchEventRegistration('event.registered', registration.id);

    ok(res, 201, {
      registration_id: registration.id,
      amount: taxed.total,
      currency: 'LKR',
      payment_params: buildCheckoutParams({
        orderId: registration.id,
        amount: taxed.total,
        firstName: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        city: req.user.city,
        baseUrl: requestBaseUrl()
      })
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error registering for event: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

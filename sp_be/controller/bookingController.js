const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { buildCheckoutParams } = require('../utils/payhere');
const { mintQrToken, requestBaseUrl } = require('../utils/tokens');
const { stripBookingSecrets, stripBookingSecretsList } = require('../utils/scrub');
const cancellationService = require('../services/cancellation');
const { publishBookingEvent } = require('../utils/publish');
const notificationCatalog = require('../utils/notificationCatalog');
const { getFlag, getTaxRate, applyInclusiveTax } = require('../utils/featureFlags');
const billService = require('../utils/billService');
const { colomboDate, colomboTime } = require('../utils/colombo');
const { windowsForDay, effectiveAdvanceDays } = require('../services/venueEngine');
const pricingEngine = require('../services/pricingEngine');
const { validateWidgetScope } = require('../services/widgetInstances');
const siteDomains = require('../services/siteDomains');

const ACTIVE_BOOKING_STATES = ['confirmed', 'checked_in', 'completed', 'no_show'];

// How many concurrent holds a player may hold before checkout is rejected.
// Production default 3 (spec/security hardening); tests may raise it.
const HOLD_LIMIT = () => Number(process.env.HOLD_LIMIT || 3);

async function getHoldConfig() {
  const { rows } = await pool.query(
    `select value from platform_config where key = 'hold_minutes'`
  );
  return rows.length ? Number(rows[0].value) : 10;
}

// The venue-entered price is the inclusive total the player pays; this
// splits out the platform + venue taxes the same way at checkout.
async function venueTaxRateForCourt(client, courtId) {
  const { rows } = await client.query(
    `select v.venue_tax_rate from courts c join venues v on v.id = c.venue_id where c.id = $1`,
    [courtId]
  );
  return rows.length ? Number(rows[0].venue_tax_rate) || 0 : 0;
}

// Split a listed (inclusive) court total into base + platform tax + venue tax.
async function splitCourtTotal(client, courtId, listedTotal, platformTaxRate) {
  const venueRate = await venueTaxRateForCourt(client, courtId);
  return applyInclusiveTax(listedTotal, platformTaxRate, venueRate);
}

exports.checkout = async (req, res) => {
  const client = await pool.connect();
  try {
    const { court_id, start_at, end_at, idempotency_key } = req.body;

    if (!court_id || !start_at || !end_at || !idempotency_key) {
      return fail(res, 400, 'CHECKOUT_VALIDATION', 'court_id, start_at, end_at, and idempotency_key are required');
    }

    const [phoneRequired, payhereEnabled, taxRate] = await Promise.all([
      getFlag('phone_verification_required'),
      getFlag('payhere_enabled'),
      getTaxRate()
    ]);

    if (phoneRequired && (!req.user.phone || !req.user.phone_verified_at)) {
      return fail(res, 409, 'VERIFIED_PHONE_REQUIRED', 'Verify your phone number before booking.');
    }

    // Verified Email gate (always-on, flag-independent): the QR must reach an
    // inbox — a phone-only Player receives only a QR *link* by SMS. App and
    // Booking Widget share this rule (template K); the old
    // phone_verification_required flag above remains for the phone gate's
    // rollout only.
    if (!req.user.email || !req.user.email_verified_at) {
      return fail(res, 409, 'VERIFIED_EMAIL_REQUIRED', 'Verify your email address before booking.');
    }

    const paymentMethod = req.body.payment_method === 'cash' ? 'cash' : 'online';
    if (paymentMethod === 'online' && !payhereEnabled) {
      return fail(res, 409, 'PAYMENT_UNAVAILABLE', 'Online payment is disabled. Choose pay-at-venue instead.');
    }

    const start = new Date(start_at);
    const end = new Date(end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return fail(res, 400, 'CHECKOUT_VALIDATION', 'Invalid time range');
    }

    const { rows: existingHoldRows } = await client.query(
      `select id, expires_at from holds where idempotency_key = $1`,
      [idempotency_key]
    );
    if (existingHoldRows.length > 0) {
      const hold = existingHoldRows[0];
      const listedTotal = await computeAmount(client, court_id, start, end);
      const split = await splitCourtTotal(client, court_id, listedTotal, taxRate);
      const user = req.user;
      return ok(res, 201, {
        hold_id: hold.id,
        idempotency_key,
        amount: split.total,
        currency: 'LKR',
        expires_at: hold.expires_at,
        payment_params: buildCheckoutParams({
          orderId: hold.id,
          amount: split.total,
          firstName: user.name,
          email: user.email,
          phone: user.phone,
          city: user.city,
          baseUrl: requestBaseUrl()
        })
      });
    }

    const { rows: courtRows } = await client.query(
      `select c.*, v.status as venue_status, v.accepts_cash, v.venue_tax_rate
       from courts c join venues v on v.id = c.venue_id
       where c.id = $1`,
      [court_id]
    );
    if (courtRows.length === 0) {
      return fail(res, 404, 'COURT_NOT_FOUND', 'Court not found');
    }
    const court = courtRows[0];
    if (court.venue_status !== 'approved' || !court.is_active) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'This court is not bookable');
    }

    // Widget bookings (ADR-0028 v1.5, ticket 05): a presented instance key
    // constrains the court to the instance's scope server-side — the venue
    // must be eligible for the instance's business and, when venue choice is
    // locked, equal the (effective) default venue. The scope degrades exactly
    // like the public config, so a stale default never dead-ends the embed.
    const widgetInstanceKey = String(req.body.widget_instance_key || '').trim();
    if (widgetInstanceKey) {
      const scope = await validateWidgetScope(client, court.venue_id, widgetInstanceKey);
      if (scope.error) {
        return fail(res, scope.error.status, scope.error.code, scope.error.message);
      }
    }

    // Dedicated Site bookings (ADR-0029): a presented site_hostname must be a
    // LIVE site of the court's own Business — one Business's site can never
    // book another Business's venue, and a dead/stale host never books.
    const siteHostname = String(req.body.site_hostname || '').trim();
    if (siteHostname) {
      const siteScope = await siteDomains.validateSiteHostname(client, court.venue_id, siteHostname);
      if (siteScope.error) {
        return fail(res, siteScope.error.status, siteScope.error.code, siteScope.error.message);
      }
    }

    const now = new Date();
    if (start < now) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is in the past');
    }

    const advanceDays = await effectiveAdvanceDays(client, court.venue_id);
    if (advanceDays > 0 && start > new Date(now.getTime() + advanceDays * 24 * 3600 * 1000)) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is beyond the booking window');
    }

    const durationMin = (end - start) / 60000;
    if (durationMin % court.slot_duration_min !== 0) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'The duration does not align with slot length');
    }

    // The booking must fit entirely inside one Opening Window — it never spans
    // a mid-day closure or a Closed Date (windowsForDay already returns [] for
    // closed dates, which is handled as "the venue is closed on this day").
    const localDate = colomboDate(start_at);
    const windows = await windowsForDay(client, court.venue_id, localDate);
    if (windows.length === 0) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'The venue is closed on this day');
    }
    const slotStart = colomboTime(start_at);
    const slotEnd = colomboTime(end_at);
    if (!windows.some((w) => slotStart >= w.open_time && slotEnd <= w.close_time)) {
      return fail(res, 400, 'BOOKING_SLOT_UNAVAILABLE', 'This booking must fit inside one opening window');
    }

    const overlaps = await client.query(
      `select 1 from bookings
       where court_id = $1 and status = any($4)
         and tstzrange(start_at, end_at) && tstzrange($2, $3)
       limit 1`,
      [court_id, start, end, ACTIVE_BOOKING_STATES]
    );
    if (overlaps.rows.length > 0) {
      return fail(res, 409, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is no longer available');
    }

    const blockOverlaps = await client.query(
      `select 1 from blocks where court_id = $1 and tstzrange(start_at, end_at) && tstzrange($2, $3) limit 1`,
      [court_id, start, end]
    );
    if (blockOverlaps.rows.length > 0) {
      return fail(res, 409, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is blocked');
    }

    const holdOverlaps = await client.query(
      `select 1 from holds
       where court_id = $1 and expires_at > now() and user_id <> $4
         and tstzrange(start_at, end_at) && tstzrange($2, $3)
       limit 1`,
      [court_id, start, end, req.user.id]
    );
    if (holdOverlaps.rows.length > 0) {
      return fail(res, 409, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is currently on hold');
    }

    // Inclusive pricing (ADR-0021): the engine prices each slot (variable
    // pricing + offers), the player pays the discounted total, and platform +
    // venue taxes are carved out of it and snapshotted.
    const pricing = await pricingEngine.computePricing(client, court, start_at, end_at);
    const listedTotal = pricing.total;
    const split = applyInclusiveTax(listedTotal, taxRate, court.venue_tax_rate || 0);
    const amount = split.total;

    if (paymentMethod === 'cash') {
      if (!court.accepts_cash) {
        return fail(res, 400, 'CASH_NOT_ACCEPTED', 'This venue does not accept pay-at-venue');
      }

      await client.query('begin');
      try {
        const { rows: bookingRows } = await client.query(
          `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, status, payment_method, player_name, player_phone, qr_token, idempotency_key, subtotal_amount, discount_amount, site_hostname)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', 'cash', $11, $12, $13, $14, $15, $16, $17)
           returning *`,
          [court_id, req.user.id, start, end, pricing.slots[0]?.base_price ?? court.price_per_slot, amount, split.platformRate, split.platformTax, split.venueRate, split.venueTax, req.user.name, req.user.phone, mintQrToken(), idempotency_key, pricing.subtotal, pricing.discount, siteHostname || null]
        );
        await client.query('commit');
        await publishBookingEvent('booking.created', bookingRows[0].id);
        await notificationCatalog.dispatchBooking('booking.confirmed', bookingRows[0].id);
        return ok(res, 201, { booking: bookingRows[0], amount, currency: 'LKR' });
      } catch (error) {
        await client.query('rollback').catch(() => {});
        if (error.code === '23505' || error.code === '23P01') {
          return fail(res, 409, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is no longer available');
        }
        throw error;
      }
    }

    const holdMinutes = await getHoldConfig();

    await client.query('begin');

    // Hold abuse caps: a player may hold at most 3 slots, and never two
    // overlapping holds on the same court (even their own — prevents
    // self-squatting until expiry).
    const { rows: activeHoldCount } = await client.query(
      `select count(*)::int as n from holds where user_id = $1 and expires_at > now()`,
      [req.user.id]
    );
    if (activeHoldCount[0].n >= HOLD_LIMIT()) {
      await client.query('rollback');
      return fail(res, 409, 'HOLD_LIMIT_REACHED', `You already have ${HOLD_LIMIT()} slots on hold. Complete or release them first.`);
    }

    const ownHoldOverlap = await client.query(
      `select 1 from holds
       where court_id = $1 and expires_at > now() and user_id = $2
         and tstzrange(start_at, end_at) && tstzrange($3, $4)
       limit 1`,
      [court_id, req.user.id, start, end]
    );
    if (ownHoldOverlap.rows.length > 0) {
      await client.query('rollback');
      return fail(res, 409, 'SLOT_HELD', 'You already hold this slot. Complete that checkout first.');
    }

    // Insert is guarded so the cap holds even under concurrent checkouts:
    // the subquery re-checks both limits inside the same statement that
    // writes the hold, so two racing requests cannot both succeed.
    const { rows: holdRows } = await client.query(
      `insert into holds (court_id, user_id, start_at, end_at, expires_at, idempotency_key, player_phone, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, subtotal_amount, discount_amount)
       select $1, $2, $3, $4, now() + ($5 || ' minutes')::interval, $6, $7, $8, $9, $10, $11, $12, $13
       where (
         (select count(*) from holds h where h.user_id = $2 and h.expires_at > now()) < $14
         and not exists (
           select 1 from holds h
           where h.court_id = $1 and h.expires_at > now() and h.user_id = $2
             and tstzrange(h.start_at, h.end_at) && tstzrange($3, $4)
         )
       )
       returning id, expires_at`,
      [court_id, req.user.id, start, end, String(holdMinutes), idempotency_key, req.user.phone, split.platformRate, split.platformTax, split.venueRate, split.venueTax, pricing.subtotal, pricing.discount, HOLD_LIMIT()]
    );

    if (holdRows.length === 0) {
      await client.query('rollback');
      return fail(res, 409, 'HOLD_LIMIT_REACHED', `You already have ${HOLD_LIMIT()} slots on hold. Complete or release them first.`);
    }
    const hold = holdRows[0];

    await client.query(
      `insert into payments (user_id, payhere_payment_id, amount, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, currency, status)
       values ($1, $2, $3, $4, $5, $6, $7, 'LKR', 'pending')`,
      [req.user.id, hold.id, amount, split.platformRate, split.platformTax, split.venueRate, split.venueTax]
    );

    await client.query('commit');

    ok(res, 201, {
      hold_id: hold.id,
      idempotency_key,
      amount,
      currency: 'LKR',
      expires_at: hold.expires_at,
      payment_params: buildCheckoutParams({
        orderId: hold.id,
        amount,
        firstName: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        city: req.user.city,
        baseUrl: requestBaseUrl()
      })
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    if (error.code === '23505') {
      return fail(res, 409, 'BOOKING_SLOT_UNAVAILABLE', 'This slot is no longer available');
    }
    logger.error(`Error creating checkout: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

async function computeAmount(client, courtId, start, end) {
  const { rows } = await client.query(
    `select * from courts where id = $1`,
    [courtId]
  );
  if (rows.length === 0) return 0;
  const court = rows[0];
  const pricing = await pricingEngine.computePricing(client, court, start.toISOString(), end.toISOString());
  return pricing.total;
}

exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `select b.*, c.name as court_name, v.name as venue_name, v.address as venue_address,
              v.owner_id as venue_owner_id, s.name as sport
       from bookings b
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       left join sports s on s.id = c.sport_id
       where b.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }

    const booking = rows[0];
    const isSelf = booking.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const ownsVenue = req.user.role === 'venue_owner' && booking.venue_owner_id === req.user.id;
    if (!isSelf && !isAdmin && !ownsVenue) {
      return fail(res, 403, 'FORBIDDEN', 'Access denied');
    }

    // The QR token is secret and single-use: it is disclosed only to the
    // booking's own player. Everyone else (admin, venue owner) gets the
    // booking without the token or the idempotency key.
    if (!isSelf) {
      stripBookingSecrets(booking);
    }

    ok(res, 200, booking);
  } catch (error) {
    logger.error(`Error fetching booking: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.listMyBookings = async (req, res) => {
  try {
    const { status, venue_id } = req.query;
    const conditions = [`b.user_id = $1`];
    const values = [req.user.id];
    let index = 2;

    if (status === 'upcoming') {
      conditions.push(`b.start_at > now() and b.status = 'confirmed'`);
    } else if (status === 'past') {
      conditions.push(`(b.start_at <= now() or b.status in ('completed', 'checked_in', 'no_show'))`);
    } else if (status === 'cancelled') {
      conditions.push(`b.status = 'cancelled'`);
    }

    // Venue-scoped list (widget "Your bookings"): the widget passes its
    // venue so the server — not a brittle client filter — decides what the
    // player sees for that embed.
    if (venue_id) {
      conditions.push(`v.id = $${index++}`);
      values.push(venue_id);
    }

    const { rows } = await pool.query(
      `select b.*, c.name as court_name, v.name as venue_name, v.city as venue_city, v.id as venue_id, s.name as sport
       from bookings b
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       left join sports s on s.id = c.sport_id
       where ${conditions.join(' and ')}
       order by b.start_at desc`,
      values
    );

    // List payloads never carry the secret QR token or the idempotency key;
    // the token is disclosed only on the player's own booking detail.
    stripBookingSecretsList(rows);

    ok(res, 200, rows);
  } catch (error) {
    logger.error(`Error listing bookings: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.cancelBooking = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await cancellationService.cancelBooking(client, req.params.id, req.user.id, req.user.role);
    if (result.error) {
      await client.query('rollback');
      return fail(res, result.error.status, result.error.code, result.error.message);
    }
    await client.query('commit');
    await publishBookingEvent('booking.cancelled', req.params.id);
    await notificationCatalog.dispatchBooking('booking.cancelled.player', req.params.id, {
      refund: { refund_amount: result.refund_amount, refund_pct: result.refund_pct }
    });
    ok(res, 200, result);
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error cancelling booking: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

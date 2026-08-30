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
const businessPaymentMethods = require('../services/businessPaymentMethods');

// Pending bookings hold their slot (ADR-0040): a booking awaiting the owner's
// confirmation blocks double-booking just like a confirmed one.
const ACTIVE_BOOKING_STATES = ['pending', 'confirmed', 'completed', 'no_show'];

// The Business's auto-confirm switch (ADR-0040): when on (default) a new
// booking is created confirmed; when off it lands `pending` until the owner
// confirms it. Resolved from the venue's Business.
async function autoConfirmForVenue(client, venueId) {
  const { rows } = await client.query(
    `select b.auto_confirm from businesses b
     join venues v on v.business_id = b.id
     where v.id = $1`,
    [venueId]
  );
  return rows.length ? Boolean(rows[0].auto_confirm) : true;
}

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

    // Per-Business payment methods (ADR-0044): the venue's Business decides
    // what a booking may be paid with. `online` is accepted as a legacy alias
    // for `payhere` (pre-migration clients) but is never stored.
    const paymentMethod = req.body.payment_method === 'cash' ? 'cash' : 'payhere';
    if (paymentMethod === 'payhere' && !payhereEnabled) {
      return fail(res, 409, 'PAYMENT_UNAVAILABLE', 'Online payment is disabled. Choose pay-at-venue instead.');
    }

    // Surface context: a widget instance key (constrains the court to the
    // instance's scope) and a site hostname (validates the venue belongs to
    // the Business's live site). Hoisted so the existing-hold replay path can
    // point PayHere's return_url back at the widget embed.
    const widgetInstanceKey = String(req.body.widget_instance_key || '').trim();
    const siteHostname = String(req.body.site_hostname || '').trim();

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
      const { rows: holdBusinessRows } = await client.query(
        `select v.business_id, v.id as venue_id from holds h
         join courts c on c.id = h.court_id
         join venues v on v.id = c.venue_id
         where h.id = $1`,
        [hold.id]
      );
      const creds = await businessPaymentMethods.resolveCheckoutCreds(
        holdBusinessRows.length ? holdBusinessRows[0].business_id : null
      );
      // Fail-closed (ADR-0015): never sign a hold with the platform gateway —
      // a Business whose creds vanished between hold and replay blocks here.
      if (!creds) {
        return fail(res, 409, 'PAYMENT_UNAVAILABLE', 'Online payment is not available right now. Choose pay-at-venue instead.');
      }
      const returnUrl = siteHostname
        ? siteReturnUrl(siteHostname, holdBusinessRows[0].venue_id, req)
        : widgetReturnUrl(widgetInstanceKey);
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
          baseUrl: requestBaseUrl(),
          merchantId: creds.merchantId,
          merchantSecret: creds.merchantSecret,
          returnUrl
        })
      });
    }

    const { rows: courtRows } = await client.query(
      `select c.*, v.status as venue_status, v.business_id, v.venue_tax_rate
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

    // Payment-method gate (ADR-0044): a Business with no enabled method is
    // fail-closed (ADR-0015) — it cannot sell anywhere until the owner turns
    // something on.
    const methods = await businessPaymentMethods.getMethodsSummary(court.business_id, client);
    if (!methods.cash_enabled && !methods.payhere_enabled) {
      return fail(res, 400, 'NO_PAYMENT_METHODS', 'This venue has no payment methods enabled');
    }
    if (paymentMethod === 'cash' && !methods.cash_enabled) {
      return fail(res, 400, 'CASH_NOT_ACCEPTED', 'This venue does not accept pay-at-venue');
    }
    if (paymentMethod === 'payhere' && !(methods.payhere_enabled && methods.payhere_configured)) {
      return fail(res, 409, 'PAYMENT_UNAVAILABLE', 'Online payment is not available here. Choose pay-at-venue instead.');
    }

    // Widget bookings (ADR-0028 v1.5, ticket 05): a presented instance key
    // constrains the court to the instance's scope server-side — the venue
    // must be eligible for the instance's business and, when venue choice is
    // locked, equal the (effective) default venue. The scope degrades exactly
    // like the public config, so a stale default never dead-ends the embed.
    if (widgetInstanceKey) {
      const scope = await validateWidgetScope(client, court.venue_id, widgetInstanceKey);
      if (scope.error) {
        return fail(res, scope.error.status, scope.error.code, scope.error.message);
      }
    }

    // Dedicated Site bookings (ADR-0029): a presented site_hostname must be a
    // LIVE site of the court's own Business — one Business's site can never
    // book another Business's venue, and a dead/stale host never books.
    if (siteHostname) {
      const siteScope = await siteDomains.validateSiteHostname(client, court.venue_id, siteHostname);
      if (siteScope.error) {
        return fail(res, siteScope.error.status, siteScope.error.code, siteScope.error.message);
      }
    } else {
      // Marketplace Listing (ADR-0031): without a site context, a venue of a
      // live-site business is bookable on the marketplace ONLY when the owner
      // opted it back in. Off-listing venues sell only via their own site.
      const { rows: listing } = await client.query(
        `select case when r.id is null then true else v.marketplace_listing end as listed
         from venues v
         left join site_domain_requests r
           on r.business_id = v.business_id and r.status = 'live'
         where v.id = $1`,
        [court.venue_id]
      );
      if (listing[0] && !listing[0].listed) {
        return fail(res, 403, 'MARKETPLACE_LISTING_OFF', 'This venue sells on its own site — book there instead');
      }
    }

    // Site Customer bookings (ADR-0030): an owner surface books as a
    // per-Business customer. The customer must belong to the venue's own
    // Business, evidenced by a valid site_context (site_hostname validated
    // above, or the widget instance already scoped to it). Payments ride the
    // Business's own gateways (ADR-0044) — no surface-level cash-only cap.
    const siteCustomer = req.user?.isSiteCustomer ? (req.siteCustomer || null) : null;
    if (siteCustomer) {
      let businessOk = false;
      if (siteHostname || widgetInstanceKey) {
        const { rows: affiliation } = await client.query(
          `select v.business_id from venues v where v.id = $1`,
          [court.venue_id]
        );
        businessOk = !!affiliation[0] && affiliation[0].business_id === siteCustomer.business_id;
      }
      if (!businessOk) {
        return fail(res, 403, 'SITE_HOST_REQUIRED', 'This booking needs a valid site context for this venue');
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
       where court_id = $1 and expires_at > now()
         and user_id is distinct from $4
         and site_customer_id is distinct from $4
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
      const autoConfirm = await autoConfirmForVenue(client, court.venue_id);
      const bookingStatus = autoConfirm ? 'confirmed' : 'pending';

      await client.query('begin');
      try {
        const { rows: bookingRows } = await client.query(
          `insert into bookings (court_id, user_id, site_customer_id, start_at, end_at, price_per_slot, total_price, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, status, payment_method, player_name, player_phone, qr_token, idempotency_key, subtotal_amount, discount_amount, site_hostname, confirmed_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'cash', $13, $14, $15, $16, $17, $18, $19, $20)
           returning *`,
          [court_id, siteCustomer ? null : req.user.id, siteCustomer ? siteCustomer.id : null, start, end, pricing.slots[0]?.base_price ?? court.price_per_slot, amount, split.platformRate, split.platformTax, split.venueRate, split.venueTax, bookingStatus, siteCustomer ? (siteCustomer.name || req.user.name) : req.user.name, siteCustomer ? (siteCustomer.phone || req.user.phone) : req.user.phone, mintQrToken(), idempotency_key, pricing.subtotal, pricing.discount, siteHostname || null, bookingStatus === 'confirmed' ? new Date() : null]
        );
        // A cash payment is born `due` at booking creation (ADR-0037): the
        // payer is known now, so mark-paid later is a status flip, not an
        // insert — this also fixes the site-customer crash (payments.user_id
        // is nullable; the site_customer_id mirrors the booking).
        await client.query(
          `insert into payments (user_id, site_customer_id, booking_id, amount, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, currency, status, payment_method)
           values ($1, $2, $3, $4, $5, $6, $7, $8, 'LKR', 'due', 'cash')`,
          [siteCustomer ? null : req.user.id, siteCustomer ? siteCustomer.id : null, bookingRows[0].id, amount, split.platformRate, split.platformTax, split.venueRate, split.venueTax]
        );
        await client.query('commit');
        await publishBookingEvent('booking.created', bookingRows[0].id);
        const confirmKey = bookingStatus === 'confirmed' ? 'booking.confirmed' : 'booking.pending';
        await notificationCatalog.dispatchBooking(confirmKey, bookingRows[0].id);
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
    // self-squatting until expiry). Site Customers hold as their
    // site_customer_id (ADR-0030); the identity OR covers both ownership forms.
    const { rows: activeHoldCount } = await client.query(
      `select count(*)::int as n from holds
       where (user_id = $1 or site_customer_id = $1) and expires_at > now()`,
      [req.user.id]
    );
    if (activeHoldCount[0].n >= HOLD_LIMIT()) {
      await client.query('rollback');
      return fail(res, 409, 'HOLD_LIMIT_REACHED', `You already have ${HOLD_LIMIT()} slots on hold. Complete or release them first.`);
    }

    const ownHoldOverlap = await client.query(
      `select 1 from holds
       where court_id = $1 and expires_at > now()
         and (user_id = $2 or site_customer_id = $2)
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
    const userId = siteCustomer ? null : req.user.id;
    const siteCustomerId = siteCustomer ? siteCustomer.id : null;
    const { rows: holdRows } = await client.query(
      `insert into holds (court_id, user_id, site_customer_id, start_at, end_at, expires_at, idempotency_key, player_phone, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, subtotal_amount, discount_amount)
       select $1, $2, $3, $4, $5, now() + ($6 || ' minutes')::interval, $7, $8, $9, $10, $11, $12, $13, $14
       where (
         (select count(*) from holds h
          where (h.user_id = $2 or h.site_customer_id = $2) and h.expires_at > now()) < $15
         and not exists (
           select 1 from holds h
           where h.court_id = $1 and h.expires_at > now()
             and (h.user_id = $2 or h.site_customer_id = $2)
             and tstzrange(h.start_at, h.end_at) && tstzrange($4, $5)
         )
       )
       returning id, expires_at`,
      [court_id, userId, siteCustomerId, start, end, String(holdMinutes), idempotency_key, req.user.phone, split.platformRate, split.platformTax, split.venueRate, split.venueTax, pricing.subtotal, pricing.discount, HOLD_LIMIT()]
    );

    if (holdRows.length === 0) {
      await client.query('rollback');
      return fail(res, 409, 'HOLD_LIMIT_REACHED', `You already have ${HOLD_LIMIT()} slots on hold. Complete or release them first.`);
    }
    const hold = holdRows[0];

    await client.query(
      `insert into payments (user_id, site_customer_id, payhere_payment_id, amount, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, currency, status, payment_method, gateway_business_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'LKR', 'pending', 'payhere', $9)`,
      [userId, siteCustomerId, hold.id, amount, split.platformRate, split.platformTax, split.venueRate, split.venueTax, court.business_id]
    );

    await client.query('commit');

    const creds = await businessPaymentMethods.resolveCheckoutCreds(court.business_id);
    if (!creds) {
      logger.error(`Checkout ${hold.id}: business ${court.business_id} payhere creds unavailable after commit`);
      return fail(res, 409, 'PAYMENT_UNAVAILABLE', 'Online payment is not available right now.');
    }

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
        baseUrl: requestBaseUrl(),
        merchantId: creds.merchantId,
        merchantSecret: creds.merchantSecret,
        returnUrl: siteHostname ? siteReturnUrl(siteHostname, court.venue_id, req) : widgetReturnUrl(widgetInstanceKey)
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

// A widget checkout's PayHere redirect returns to the widget's own embed URL
// (the iframe lands back in the flow, where the customer's booking is listed
// under "Your bookings") — never to the platform root.
function widgetReturnUrl(instanceKey) {
  if (!instanceKey) return null;
  return `${requestBaseUrl()}/embed/${encodeURIComponent(String(instanceKey))}`;
}

// A Dedicated Site checkout's PayHere redirect returns to the site's own book
// page — the exact URL the customer came from (Referer, validated against the
// presented site hostname), so the slot context restores; fall back to the
// Origin header (scheme-safe) or a plain http(s) book URL. Never the platform
// root. Re-checkout on the returned page is safe: the own-hold guard answers
// SLOT_HELD instead of minting a second payment.
function siteReturnUrl(siteHostname, venueId, req) {
  const host = String(siteHostname || '').trim().toLowerCase().replace(/^https?:\/\//, '');
  if (host) {
    const referer = req.get('referer');
    if (referer) {
      try {
        const url = new URL(referer);
        if (url.hostname.toLowerCase() === host) return referer;
      } catch {
        // ignore malformed referer
      }
    }
    const origin = req.get('origin');
    if (origin) {
      try {
        const url = new URL(origin);
        if (url.hostname.toLowerCase() === host) return `${origin}/book/${venueId}`;
      } catch {
        // ignore malformed origin
      }
    }
  }
  return null;
}

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
              v.owner_id as venue_owner_id, s.name as sport,
              (select p.status from payments p where p.booking_id = b.id order by p.created_at desc limit 1) as payment_status,
              (select p.paid_at from payments p where p.booking_id = b.id and p.status = 'paid' order by p.paid_at desc nulls last limit 1) as paid_at
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
    // A Site Customer owns the bookings made under their per-Business account
    // (site_customer_id) — the same "self" right as a Player's user_id booking,
    // including the QR token (the customer is the player).
    const isSelf =
      booking.user_id === req.user.id ||
      (req.siteCustomer && booking.site_customer_id === req.siteCustomer.id);
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
    // "My bookings" spans both ownership forms: a platform Player's user_id
    // rows and a Site Customer's per-Business site_customer_id rows (the same
    // req.user.id — the authenticate middleware maps the site token onto it).
    const conditions = [`(b.user_id = $1 or b.site_customer_id = $1)`];
    const values = [req.user.id];
    let index = 2;

    if (status === 'upcoming') {
      conditions.push(`b.start_at > now() and b.status in ('pending', 'confirmed')`);
    } else if (status === 'past') {
      conditions.push(`(b.start_at <= now() or b.status in ('completed', 'no_show'))`);
    } else if (status === 'cancelled') {
      conditions.push(`b.status in ('cancelled', 'cancelled_by_user', 'cancelled_by_owner', 'cancelled_by_admin', 'cancelled_auto')`);
    }

    // Venue-scoped list (widget "Your bookings"): the widget passes its
    // venue so the server — not a brittle client filter — decides what the
    // player sees for that embed.
    if (venue_id) {
      conditions.push(`v.id = $${index++}`);
      values.push(venue_id);
    }

    const { rows } = await pool.query(
      `select b.*, c.name as court_name, v.name as venue_name, v.city as venue_city, v.id as venue_id, s.name as sport,
              (select p.status from payments p where p.booking_id = b.id order by p.created_at desc limit 1) as payment_status,
              (select p.paid_at from payments p where p.booking_id = b.id and p.status = 'paid' order by p.paid_at desc nulls last limit 1) as paid_at
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
    const result = await cancellationService.cancelBooking(
      client,
      req.params.id,
      req.user.id,
      req.user.role,
      req.siteCustomer?.id
    );
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

const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');
const { enableBusinessCash, enableBusinessPayhere } = require('./helpers/methods');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

// Dedicated accounts for this file (never the shared demo owner/player) so the
// business-level auto-confirm toggles can't leak into other test files.
const rand = Math.random().toString(36).slice(2, 10);
const OWNER_UID = `status-owner-${rand}`;
const PLAYER_UID = `status-player-${rand}`;

let VENUE_ID;
let COURT_ID;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;
let BUSINESS_ID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

describe('booking status overhaul (ADR-0037/0038/0040)', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');

    // Dedicated owner (onboarded) + business + venue, and a dedicated player.
    const { rows: owner } = await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ($1, $2, 'Status Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set role = 'venue_owner', onboarding_state = 'accepted'
       returning id`,
      [OWNER_UID, `status-owner-${rand}@myslot.test`]
    );
    OWNER_TOKEN = await tokenFor(OWNER_UID);
    const { rows: biz } = await pool.query(
      `insert into businesses (owner_id, name) values ($1, 'Status Business') returning *`,
      [owner[0].id]
    );
    BUSINESS_ID = biz[0].id;
    // ADR-0044: this suite's cash/online checkouts ride the Business methods.
    await pool.query(
      `insert into business_payment_methods (business_id, method, enabled) values
         ($1, 'cash', true),
         ($1, 'payhere', false)
       on conflict (business_id, method) do update set enabled = excluded.enabled`,
      [BUSINESS_ID]
    );
    await enableBusinessPayhere(OWNER_UID, true);

    const { rows: player } = await pool.query(
      `insert into users (firebase_uid, email, name, role, status, phone, phone_verified_at, email_verified_at)
       values ($1, $2, 'Status Player', 'player', 'active', '+94770000002', now(), now())
       on conflict (firebase_uid) do update set phone_verified_at = now(), email_verified_at = now()
       returning id`,
      [PLAYER_UID, `status-player-${rand}@myslot.test`]
    );
    void player;
    PLAYER_TOKEN = await tokenFor(PLAYER_UID);

    const venue = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        name: 'Status Venue',
        address: '9 Status Ave',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: 'Status Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    VENUE_ID = venue.body.data.id;
    await request(app).post(`/api/v1/admin/venues/${VENUE_ID}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows: courtRows } = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURT_ID = courtRows[0].id;
  });

  afterAll(async () => {
    await pool.query(`update businesses set auto_confirm = true, pending_auto_cancel_hours = 4 where id = $1`, [BUSINESS_ID]);
  });

  it('auto-confirm ON creates a confirmed cash booking with a due payment (default)', async () => {
    const date = colomboDate(2);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '09:00'),
        end_at: isoColombo(date, '10:00'),
        payment_method: 'cash',
        idempotency_key: `status-on-${Date.now()}`
      });
    if (res.status !== 201) console.log('CHECKOUT FAIL', JSON.stringify(res.body), { COURT_ID, VENUE_ID });
    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe('confirmed');
    const { rows } = await pool.query(
      `select status, payment_method from payments where booking_id = $1`,
      [res.body.data.booking.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('due');
    expect(rows[0].payment_method).toBe('cash');
  });

  it('auto-confirm OFF lands a cash booking pending; owner confirms it', async () => {
    await pool.query(`update businesses set auto_confirm = false where id = $1`, [BUSINESS_ID]);
    const date = colomboDate(3);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        payment_method: 'cash',
        idempotency_key: `status-off-${Date.now()}`
      });
    expect(res.status).toBe(201);
    const booking = res.body.data.booking;
    expect(booking.status).toBe('pending');

    // A pending booking cannot be checked in.
    const checkin = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(checkin.status).toBe(409);
    expect(checkin.body.error.code).toBe('CHECK_IN_PENDING');

    // The owner confirms it.
    const confirm = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.status).toBe('confirmed');

    const { rows } = await pool.query(`select status, confirmed_at from bookings where id = $1`, [booking.id]);
    expect(rows[0].status).toBe('confirmed');
    expect(rows[0].confirmed_at).toBeTruthy();

    // Confirming twice is a no-op, not an error.
    const again = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(again.status).toBe(200);

    await pool.query(`update businesses set auto_confirm = true where id = $1`, [BUSINESS_ID]);
  });

  it('a pending booking self-cancels freely (no cutoff) with a full refund', async () => {
    await pool.query(`update businesses set auto_confirm = false where id = $1`, [BUSINESS_ID]);
    const date = colomboDate(4);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '11:00'),
        end_at: isoColombo(date, '12:00'),
        payment_method: 'cash',
        idempotency_key: `status-cancel-${Date.now()}`
      });
    expect(res.body.data.booking.status).toBe('pending');

    const cancel = await request(app)
      .post(`/api/v1/bookings/${res.body.data.booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('cancelled_by_user');
    await pool.query(`update businesses set auto_confirm = true where id = $1`, [BUSINESS_ID]);
  });

  it('mark-paid on a pending cash booking flips the due payment to paid', async () => {
    await pool.query(`update businesses set auto_confirm = false where id = $1`, [BUSINESS_ID]);
    const date = colomboDate(5);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '12:00'),
        end_at: isoColombo(date, '13:00'),
        payment_method: 'cash',
        idempotency_key: `status-paid-${Date.now()}`
      });
    const bookingId = res.body.data.booking.id;
    expect(res.body.data.booking.status).toBe('pending');

    const mark = await request(app)
      .post(`/api/v1/business/bookings/${bookingId}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(mark.status).toBe(200);
    expect(mark.body.data.status).toBe('paid');

    const { rows } = await pool.query(`select count(*)::int as n from payments where booking_id = $1`, [bookingId]);
    expect(rows[0].n).toBe(1);
    await pool.query(`update businesses set auto_confirm = true where id = $1`, [BUSINESS_ID]);
  });

  it('booking settings are read and updated per business', async () => {
    const get = await request(app)
      .get('/api/v1/business/booking-settings')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(get.status).toBe(200);
    expect(typeof get.body.data.auto_confirm).toBe('boolean');

    const put = await request(app)
      .put('/api/v1/business/booking-settings')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ auto_confirm: false, pending_auto_cancel_hours: 6 });
    expect(put.status).toBe(200);
    expect(put.body.data.auto_confirm).toBe(false);
    expect(put.body.data.pending_auto_cancel_hours).toBe(6);

    const bad = await request(app)
      .put('/api/v1/business/booking-settings')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ pending_auto_cancel_hours: 0 });
    expect(bad.status).toBe(400);

    await pool.query(`update businesses set auto_confirm = true, pending_auto_cancel_hours = 4 where id = $1`, [BUSINESS_ID]);
  });

  it('the pending auto-cancel job cancels a stale pending booking', async () => {
    const { runAutoCancelJob } = require('../jobs/autoCancelPending');
    await pool.query(`update businesses set auto_confirm = false, pending_auto_cancel_hours = 4 where id = $1`, [BUSINESS_ID]);
    const { rows: userRows } = await pool.query(`select id from users where firebase_uid = $1`, [PLAYER_UID]);

    // A pending booking 1h before start: within the 4h auto-cancel window.
    const startAt = new Date(Date.now() + 1 * 3600 * 1000).toISOString();
    const endAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const { rows: created } = await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key, payment_method, qr_token)
       values ($1, $2, $3, $4, 1500, 1500, 'pending', $5, 'cash', $6)
       returning *`,
      [COURT_ID, userRows[0].id, startAt, endAt, `autocancel-${Math.random().toString(36).slice(2)}`, `tok-${Math.random().toString(36).slice(2)}`]
    );
    const bookingId = created[0].id;
    await pool.query(
      `insert into payments (user_id, booking_id, amount, currency, status, payment_method)
       values ($1, $2, 1500, 'LKR', 'due', 'cash')`,
      [userRows[0].id, bookingId]
    );

    await runAutoCancelJob();

    const { rows } = await pool.query(`select status from bookings where id = $1`, [bookingId]);
    expect(rows[0].status).toBe('cancelled_auto');

    // A pending booking far out is left alone.
    const farStart = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    const farEnd = new Date(Date.now() + 5 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();
    const { rows: far } = await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key, payment_method, qr_token)
       values ($1, $2, $3, $4, 1500, 1500, 'pending', $5, 'cash', $6)
       returning id`,
      [COURT_ID, userRows[0].id, farStart, farEnd, `autocancel-far-${Math.random().toString(36).slice(2)}`, `tok-far-${Math.random().toString(36).slice(2)}`]
    );
    await runAutoCancelJob();
    const { rows: farAfter } = await pool.query(`select status from bookings where id = $1`, [far[0].id]);
    expect(farAfter[0].status).toBe('pending');

    await pool.query(`update businesses set auto_confirm = true, pending_auto_cancel_hours = 4 where id = $1`, [BUSINESS_ID]);
  });

  it('regression: mark-paid no longer crashes on a site-customer cash booking (user_id NULL)', async () => {
    const { rows: sc } = await pool.query(
      `insert into site_customers (business_id, email, name, phone, email_verified_at, phone_verified_at)
       values ($1, $2, 'Crash Pam', '+94770000001', now(), now())
       returning id`,
      [BUSINESS_ID, `crash-pam-${Date.now()}@test.lk`]
    );
    const customer = sc[0];
    const { rows: userRows } = await pool.query(`select id from users where firebase_uid = $1`, [PLAYER_UID]);
    const startAt = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    const endAt = new Date(Date.now() + 2 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();
    const { rows: created } = await pool.query(
      `insert into bookings (court_id, site_customer_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key, payment_method, qr_token)
       values ($1, $2, $3, $4, 1500, 1500, 'confirmed', $5, 'cash', $6)
       returning *`,
      [COURT_ID, customer.id, startAt, endAt, `sc-crash-${Math.random().toString(36).slice(2)}`, `tok-sc-${Math.random().toString(36).slice(2)}`]
    );
    const bookingId = created[0].id;
    // A site-customer cash payment is born `due` with site_customer_id and a
    // NULL user_id — mark-paid must flip it, not crash on the old NOT NULL.
    await pool.query(
      `insert into payments (site_customer_id, booking_id, amount, currency, status, payment_method)
       values ($1, $2, 1500, 'LKR', 'due', 'cash')`,
      [customer.id, bookingId]
    );

    const mark = await request(app)
      .post(`/api/v1/business/bookings/${bookingId}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(mark.status).toBe(200);
    expect(mark.body.data.status).toBe('paid');
  });
});

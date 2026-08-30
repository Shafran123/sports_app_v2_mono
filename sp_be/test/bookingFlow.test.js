const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let VENUE_ID;
let COURT_ID;
let PLAYER_TOKEN;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

describe('booking flow', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    const ownerToken = await tokenFor('demo-owner-uid');
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Booking Test Venue',
        address: '2 Test Ave',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: 'Book Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });

    VENUE_ID = submitted.body.data.id;
    await request(app)
      .post(`/api/v1/admin/venues/${VENUE_ID}/approve`)
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);

    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURT_ID = rows[0].id;
  });

  it('checkout creates a hold and returns payment params', async () => {
    const date = colomboDate(2);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        idempotency_key: 'checkout-1'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.hold_id).toBeTruthy();
    expect(res.body.data.amount).toBe(1500);
    expect(res.body.data.currency).toBe('LKR');
    expect(res.body.data.payment_params.order_id).toBeTruthy();
    expect(res.body.data.payment_params.amount).toBe('1500');
    expect(res.body.data.expires_at).toBeTruthy();

    // Release the hold so later tests in this suite stay under the
    // 3-concurrent-holds-per-player cap.
    await pool.query(`delete from holds where idempotency_key = $1`, ['checkout-1']);
  });

  it('accepts a UTC ISO slot time from the frontend at opening hour (timezone parity with availability)', async () => {
    const date = colomboDate(2);
    // The frontend sends what availability returns: UTC instants (…Z). 06:00 Colombo
    // is 00:30Z — this must be accepted, not rejected as "outside opening hours".
    const startAt = new Date(`${date}T06:00:00+05:30`).toISOString();
    const endAt = new Date(`${date}T07:00:00+05:30`).toISOString();
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: startAt,
        end_at: endAt,
        idempotency_key: 'checkout-utc-opening'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.hold_id).toBeTruthy();
    await pool.query(`delete from holds where idempotency_key = $1`, ['checkout-utc-opening']);
  });

  it('replaying the same checkout returns the same hold (idempotent)', async () => {
    const date = colomboDate(2);
    const payload = {
      court_id: COURT_ID,
      start_at: isoColombo(date, '11:00'),
      end_at: isoColombo(date, '12:00'),
      idempotency_key: 'checkout-same'
    };
    const first = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send(payload);
    const second = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send(payload);

    expect(second.status).toBe(201);
    expect(second.body.data.hold_id).toBe(first.body.data.hold_id);
    await pool.query(`delete from holds where idempotency_key = $1`, ['checkout-same']);
  });

  it('cannot checkout a slot another user holds', async () => {
    const date = colomboDate(3);
    await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '12:00'),
        end_at: isoColombo(date, '13:00'),
        idempotency_key: 'checkout-held-by-me'
      });

    const otherToken = await tokenFor('demo-owner-uid');
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '12:00'),
        end_at: isoColombo(date, '13:00'),
        idempotency_key: 'checkout-steal-attempt'
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
    await pool.query(`delete from holds where idempotency_key = $1`, ['checkout-held-by-me']);
  });

  it('cannot checkout a slot with a confirmed booking', async () => {
    const date = colomboDate(4);
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, payment_method) values ($1, $2, $3, $4, 1500, 1500, 'confirmed', 'cash')`,
      [COURT_ID, rows[0].id, isoColombo(date, '08:00'), isoColombo(date, '09:00')]
    );

    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '08:00'),
        end_at: isoColombo(date, '09:00'),
        idempotency_key: 'checkout-over-booked'
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('expired holds do not block checkout', async () => {
    const date = colomboDate(5);
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    await pool.query(
      `insert into holds (court_id, user_id, start_at, end_at, expires_at, idempotency_key)
       values ($1, $2, $3, $4, now() - interval '1 minute', 'expired-hold')`,
      [COURT_ID, rows[0].id, isoColombo(date, '09:00'), isoColombo(date, '10:00')]
    );

    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '09:00'),
        end_at: isoColombo(date, '10:00'),
        idempotency_key: 'checkout-after-expiry'
      });

    expect(res.status).toBe(201);
    await pool.query(`delete from holds where idempotency_key = $1`, ['checkout-after-expiry']);
  });

  it('computes the price from court price and duration', async () => {
    const date = colomboDate(6);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '15:00'),
        end_at: isoColombo(date, '17:00'),
        idempotency_key: 'checkout-2-hours'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(3000);
    await pool.query(`delete from holds where idempotency_key = $1`, ['checkout-2-hours']);
  });

  it('rejects a slot outside opening hours', async () => {
    const date = colomboDate(7);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '23:00'),
        end_at: isoColombo(date, '23:59'),
        idempotency_key: 'checkout-late'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('rejects a slot in the past', async () => {
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(colomboDate(-1), '10:00'),
        end_at: isoColombo(colomboDate(-1), '11:00'),
        idempotency_key: 'checkout-past'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('rejects unknown courts', async () => {
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: '99999999-9999-9999-9999-999999999999',
        start_at: isoColombo(colomboDate(2), '10:00'),
        end_at: isoColombo(colomboDate(2), '11:00'),
        idempotency_key: 'checkout-unknown-court'
      });

    expect(res.status).toBe(404);
  });

  it('hold appears as held in availability', async () => {
    const date = colomboDate(9);
    await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(date, '18:00'),
        end_at: isoColombo(date, '19:00'),
        idempotency_key: 'checkout-visibility'
      });

    const res = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability?date=${date}`);
    const court = res.body.data.courts.find((c) => c.court_id === COURT_ID);
    const slot = court.slots.find(
      (s) => new Date(s.start_at).getTime() === new Date(isoColombo(date, '18:00')).getTime()
    );
    expect(slot.state).toBe('held');
  });
});

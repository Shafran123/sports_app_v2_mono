const request = require('supertest');
const { SignJWT } = require('jose');
const crypto = require('crypto');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags, resetFlagsToDefaults } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let VENUE_ID;
let COURT_ID;
let CASH_VENUE_ID;
let CASH_COURT_ID;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;
let PLAYER_UID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

async function createVenue(ownerToken, name, acceptsCash) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name,
      address: '9 Verify Ave',
      city: 'Colombo',
      accepts_cash: acceptsCash,
      sports: ['badminton'],
      courts: [
        { name: 'Verify Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

async function checkout(token, courtId) {
  const date = colomboDate(2);
  return request(app)
    .post('/api/v1/bookings/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({
      court_id: courtId,
      start_at: isoColombo(date, '14:00'),
      end_at: isoColombo(date, '15:00'),
      idempotency_key: `vp-${Date.now()}-${Math.random()}`,
      payment_method: courtId === CASH_COURT_ID ? 'cash' : undefined
    });
}

describe('verified-phone booking gate', () => {
  beforeAll(async () => {
    // This suite exercises the original hard-gate behavior, so enable the
    // feature flags that gate phone verification and online payment. Defaults
    // (OFF) are covered by featureFlags.test.js / flagsGates.test.js.
    await enableLegacyFlags();

    PLAYER_UID = `vp-player-${Date.now()}`;
    PLAYER_TOKEN = await tokenFor(PLAYER_UID);
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');

    const onlineVenue = await createVenue(OWNER_TOKEN, 'Verify Online Venue', false);
    const cashVenue = await createVenue(OWNER_TOKEN, 'Verify Cash Venue', true);
    await request(app).post(`/api/v1/admin/venues/${onlineVenue}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(app).post(`/api/v1/admin/venues/${cashVenue}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const { rows: onlineRows } = await pool.query(`select id from courts where venue_id = $1`, [onlineVenue]);
    const { rows: cashRows } = await pool.query(`select id from courts where venue_id = $1`, [cashVenue]);
    COURT_ID = onlineRows[0].id;
    CASH_COURT_ID = cashRows[0].id;
    VENUE_ID = onlineVenue;
    CASH_VENUE_ID = cashVenue;
  });

  afterAll(async () => {
    await resetFlagsToDefaults();
  });

  it('blocks online checkout for an unverified player with 409 VERIFIED_PHONE_REQUIRED', async () => {
    const res = await checkout(PLAYER_TOKEN, COURT_ID);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERIFIED_PHONE_REQUIRED');
  });

  it('blocks cash checkout for an unverified player with 409 VERIFIED_PHONE_REQUIRED', async () => {
    const res = await checkout(PLAYER_TOKEN, CASH_COURT_ID);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERIFIED_PHONE_REQUIRED');
  });

  it('lets a verified player start an online checkout', async () => {
    await pool.query(
      `update users set phone = '+94771234567', phone_verified_at = now() where firebase_uid = $1`,
      [PLAYER_UID]
    );
    const res = await checkout(PLAYER_TOKEN, COURT_ID);
    expect(res.status).toBe(201);
    expect(res.body.data.hold_id).toBeDefined();
    // Release so the same-slot test below isn't blocked by the own-hold cap.
    await pool.query(`delete from holds where idempotency_key = $1`, [res.body.data.idempotency_key]);
  });

  it('stamps the verified phone on a cash booking', async () => {
    const res = await checkout(PLAYER_TOKEN, CASH_COURT_ID);
    expect(res.status).toBe(201);
    expect(res.body.data.booking.player_phone).toBe('+94771234567');

    const { rows } = await pool.query(
      `select player_phone from bookings where id = $1`,
      [res.body.data.booking.id]
    );
    expect(rows[0].player_phone).toBe('+94771234567');
  });

  it('keeps the checkout-time phone on the booking even if the profile phone changes later', async () => {
    await pool.query(
      `update users set phone = '+94771234567', phone_verified_at = now() where firebase_uid = $1`,
      [PLAYER_UID]
    );
    const res = await checkout(PLAYER_TOKEN, COURT_ID);
    expect(res.status).toBe(201);
    const holdId = res.body.data.hold_id;

    await pool.query(
      `update users set phone = '+94779999999', phone_verified_at = null where firebase_uid = $1`,
      [PLAYER_UID]
    );

    const amount = res.body.data.amount;
    const secretMd5 = crypto.createHash('md5').update(process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret').digest('hex').toUpperCase();
    const md5sig = crypto
      .createHash('md5')
      .update(`TEST_MERCHANT_ID${holdId}${amount}LKR2${secretMd5}`)
      .digest('hex')
      .toUpperCase();
    const notify = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send({
        merchant_id: 'TEST_MERCHANT_ID',
        order_id: holdId,
        payhere_amount: String(amount),
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig
      });
    expect(notify.status).toBe(200);

    const { rows } = await pool.query(
      `select player_phone from bookings where idempotency_key = $1`,
      [res.body.data.idempotency_key]
    );
    expect(rows[0].player_phone).toBe('+94771234567');
  });

  it('clears verification when the phone is changed via profile', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({ phone: '+94779999999' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+94779999999');
    expect(res.body.data.phone_verified_at).toBeNull();
  });

  it('keeps verification when the profile phone is unchanged', async () => {
    await pool.query(
      `update users set phone = '+94771234567', phone_verified_at = now() where firebase_uid = $1`,
      [PLAYER_UID]
    );
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({ phone: '+94771234567' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone_verified_at).not.toBeNull();
  });

  it('lets an admin mark a player verified directly', async () => {
    const { rows } = await pool.query(
      `select id from users where firebase_uid = $1`,
      [PLAYER_UID]
    );
    const res = await request(app)
      .post(`/api/v1/admin/players/${rows[0].id}/verify`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.phone_verified_at).not.toBeNull();
  });

  it('rejects a player calling the admin verify endpoint', async () => {
    const { rows } = await pool.query(
      `select id from users where firebase_uid = $1`,
      [PLAYER_UID]
    );
    const res = await request(app)
      .post(`/api/v1/admin/players/${rows[0].id}/verify`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
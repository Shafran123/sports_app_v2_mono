const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');
const crypto = require('crypto');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let VENUE_ID;
let COURT_ID;
let PLAYER_TOKEN;
let PLAYER_ID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

function payhereSig({ orderId, amount, statusCode }) {
  const secretMd5 = crypto.createHash('md5').update('test-merchant-secret').digest('hex').toUpperCase();
  return crypto
    .createHash('md5')
    .update(`TEST_MERCHANT_ID${orderId}${amount}LKR${statusCode}${secretMd5}`)
    .digest('hex')
    .toUpperCase();
}

function webhookBody(orderId, amount, statusCode = '2') {
  return {
    merchant_id: 'TEST_MERCHANT_ID',
    order_id: orderId,
    payment_id: 'pay_crit',
    payhere_amount: String(amount),
    payhere_currency: 'LKR',
    status_code: statusCode,
    method: 'TEST',
    status_message: 'ok',
    md5sig: payhereSig({ orderId, amount, statusCode })
  };
}

async function checkout(dateStr, timeStr, idemKey, token = PLAYER_TOKEN) {
  const res = await request(app)
    .post('/api/v1/bookings/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({
      court_id: COURT_ID,
      start_at: isoColombo(dateStr, timeStr),
      end_at: isoColombo(dateStr, String(Number(timeStr.slice(0, 2)) + 1).padStart(2, '0') + ':00'),
      idempotency_key: idemKey
    });
  return res;
}

describe('critical booking tests', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    PLAYER_ID = rows[0].id;

    const ownerToken = await tokenFor('demo-owner-uid');
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Critical Test Venue',
        address: '4 Test Ave',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: 'Critical Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    VENUE_ID = submitted.body.data.id;
    await request(app)
      .post(`/api/v1/admin/venues/${VENUE_ID}/approve`)
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);

    const courtRows = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURT_ID = courtRows.rows[0].id;
  });

  it('two concurrent checkouts for the same slot: only one wins the webhook race', async () => {
    const date = colomboDate(3);
    const playerAToken = PLAYER_TOKEN;
    const playerBToken = await tokenFor('other-player-uid');
    await pool.query(
      `update users set phone_verified_at = now() where firebase_uid = 'other-player-uid'`
    );

    const [checkoutA, checkoutB] = await Promise.all([
      checkout(date, '08:00', 'crit-a'),
      checkout(date, '08:00', 'crit-b', playerBToken)
    ]);

    const holdIds = [
      checkoutA.status === 201 ? checkoutA.body.data.hold_id : null,
      checkoutB.status === 201 ? checkoutB.body.data.hold_id : null
    ].filter(Boolean);
    expect(holdIds.length).toBeGreaterThanOrEqual(1);

    const webhooks = holdIds.map((holdId) =>
      request(app).post('/api/v1/payments/payhere/notify').type('form').send(webhookBody(holdId, 1500))
    );
    await Promise.all(webhooks);

    const { rows } = await pool.query(
      `select count(*)::int as n from bookings where court_id = $1 and start_at = $2 and status <> 'cancelled'`,
      [COURT_ID, isoColombo(date, '08:00')]
    );
    expect(rows[0].n).toBe(1);
  });

  it('an expired hold does not block a fresh checkout', async () => {
    const date = colomboDate(4);
    const res = await checkout(date, '10:00', 'crit-expire');
    expect(res.status).toBe(201);

    await pool.query(`update holds set expires_at = now() - interval '1 minute' where id = $1`, [res.body.data.hold_id]);

    const second = await checkout(date, '10:00', 'crit-expire-2');
    expect(second.status).toBe(201);
    expect(second.body.data.hold_id).not.toBe(res.body.data.hold_id);
  });

  it('a replayed webhook does not double-confirm (already covered, asserted again end-to-end)', async () => {
    const date = colomboDate(5);
    const res = await checkout(date, '11:00', 'crit-replay');
    expect(res.status).toBe(201);
    const holdId = res.body.data.hold_id;

    await request(app).post('/api/v1/payments/payhere/notify').type('form').send(webhookBody(holdId, 1500));
    await request(app).post('/api/v1/payments/payhere/notify').type('form').send(webhookBody(holdId, 1500));

    const { rows } = await pool.query(
      `select count(*)::int as n from bookings where idempotency_key = 'crit-replay'`
    );
    expect(rows[0].n).toBe(1);
  });
});

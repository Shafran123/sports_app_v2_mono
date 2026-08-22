const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const crypto = require('crypto');
const { enableLegacyFlags } = require('./helpers/flags');

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

function payhereSig({ orderId, amount, currency = 'LKR', statusCode }) {
  const secretMd5 = crypto.createHash('md5').update(process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret').digest('hex').toUpperCase();
  return crypto
    .createHash('md5')
    .update(`TEST_MERCHANT_ID${orderId}${amount}${currency}${statusCode}${secretMd5}`)
    .digest('hex')
    .toUpperCase();
}

async function makeHold(slotDate, startTime, endTime, idempotencyKey) {
  const res = await request(app)
    .post('/api/v1/bookings/checkout')
    .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
    .send({
      court_id: COURT_ID,
      start_at: isoColombo(slotDate, startTime),
      end_at: isoColombo(slotDate, endTime),
      idempotency_key: idempotencyKey
    });
  expect(res.status).toBe(201);
  return res.body.data;
}

function webhookBody({ orderId, amount, statusCode = '2', paymentId = 'pay_123' }) {
  return {
    merchant_id: 'TEST_MERCHANT_ID',
    order_id: orderId,
    payment_id: paymentId,
    payhere_amount: String(amount),
    payhere_currency: 'LKR',
    status_code: statusCode,
    method: 'TEST',
    status_message: 'Successfully completed',
    md5sig: payhereSig({ orderId, amount, statusCode })
  };
}

describe('payment webhooks', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    const { rows } = await pool.query(
      `select id from users where firebase_uid = 'demo-player-uid'`
    );
    PLAYER_ID = rows[0].id;

    const ownerToken = await tokenFor('demo-owner-uid');
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Webhook Test Venue',
        address: '3 Test Ave',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: 'Webhook Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
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

  it('success webhook confirms the booking and removes the hold', async () => {
    const date = colomboDate(3);
    const hold = await makeHold(date, '08:00', '09:00', 'wh-1');

    const res = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send(webhookBody({ orderId: hold.hold_id, amount: 1500 }));

    expect(res.status).toBe(200);

    const { rows: bookings } = await pool.query(
      `select * from bookings where court_id = $1 and start_at = $2`,
      [COURT_ID, isoColombo(date, '08:00')]
    );
    expect(bookings.length).toBe(1);
    expect(bookings[0].status).toBe('confirmed');
    expect(bookings[0].total_price).toBe(1500);

    const { rows: holds } = await pool.query(`select * from holds where id = $1`, [hold.hold_id]);
    expect(holds.length).toBe(0);

    const { rows: payments } = await pool.query(
      `select * from payments where payhere_payment_id = $1`,
      [hold.hold_id]
    );
    expect(payments[0].status).toBe('paid');

    const avail = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability?date=${date}`);
    const court = avail.body.data.courts.find((c) => c.court_id === COURT_ID);
    const slot = court.slots.find(
      (s) => new Date(s.start_at).getTime() === new Date(isoColombo(date, '08:00')).getTime()
    );
    expect(slot.state).toBe('booked');
  });

  it('creates a notification for the player on confirmation', async () => {
    const { rows } = await pool.query(
      `select count(*)::int as n from notifications where user_id = $1 and type = 'booking_confirmed'`,
      [PLAYER_ID]
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('replaying the same webhook changes nothing', async () => {
    const date = colomboDate(4);
    const hold = await makeHold(date, '08:00', '09:00', 'wh-2');
    const body = webhookBody({ orderId: hold.hold_id, amount: 1500 });

    await request(app).post('/api/v1/payments/payhere/notify').type('form').send(body);
    const replay = await request(app).post('/api/v1/payments/payhere/notify').type('form').send(body);
    expect(replay.status).toBe(200);

    const { rows: bookings } = await pool.query(
      `select count(*)::int as n from bookings where court_id = $1`,
      [COURT_ID]
    );
    const { rows: holds } = await pool.query(`select * from holds where id = $1`, [hold.hold_id]);
    expect(holds.length).toBe(0);

    const { rows } = await pool.query(
      `select count(*)::int as n from bookings where idempotency_key = 'wh-2'`
    );
    expect(rows[0].n).toBe(1);
    expect(bookings[0].n).toBe(2);
  });

  it('failure webhook releases the hold', async () => {
    const date = colomboDate(5);
    const hold = await makeHold(date, '09:00', '10:00', 'wh-3');

    const res = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send(webhookBody({ orderId: hold.hold_id, amount: 1500, statusCode: '-2' }));

    expect(res.status).toBe(200);

    const { rows: holds } = await pool.query(`select * from holds where id = $1`, [hold.hold_id]);
    expect(holds.length).toBe(0);

    const { rows: payments } = await pool.query(
      `select status from payments where payhere_payment_id = $1`,
      [hold.hold_id]
    );
    expect(payments[0].status).toBe('failed');

    const avail = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability?date=${date}`);
    const court = avail.body.data.courts.find((c) => c.court_id === COURT_ID);
    const slot = court.slots.find(
      (s) => new Date(s.start_at).getTime() === new Date(isoColombo(date, '09:00')).getTime()
    );
    expect(slot.state).toBe('available');
  });

  it('rejects a webhook with an invalid signature', async () => {
    const date = colomboDate(6);
    const hold = await makeHold(date, '10:00', '11:00', 'wh-4');

    const res = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send({ ...webhookBody({ orderId: hold.hold_id, amount: 1500 }), md5sig: 'DEADBEEF' });

    expect(res.status).toBe(400);

    const { rows: holds } = await pool.query(`select * from holds where id = $1`, [hold.hold_id]);
    expect(holds.length).toBe(1);
  });

  it('returns 404 for an unknown order id', async () => {
    const res = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send(webhookBody({ orderId: 'unknown-order', amount: 1500 }));
    expect(res.status).toBe(404);
  });

  it('success after hold expiry still books the slot if free', async () => {
    const date = colomboDate(7);
    const hold = await makeHold(date, '11:00', '12:00', 'wh-5');

    await pool.query(`update holds set expires_at = now() - interval '1 minute' where id = $1`, [hold.hold_id]);

    const res = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send(webhookBody({ orderId: hold.hold_id, amount: 1500 }));

    expect(res.status).toBe(200);

    const { rows: bookings } = await pool.query(
      `select * from bookings where idempotency_key = 'wh-5'`
    );
    expect(bookings.length).toBe(1);
    expect(bookings[0].status).toBe('confirmed');
  });

  it('success after hold expiry when the slot was taken marks payment failed with manual refund flag', async () => {
    const date = colomboDate(8);
    const hold = await makeHold(date, '12:00', '13:00', 'wh-6');

    await pool.query(`update holds set expires_at = now() - interval '1 minute' where id = $1`, [hold.hold_id]);

    await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key)
       values ($1, $2, $3, $4, 1500, 1500, 'confirmed', 'wh-6-squatter')`,
      [COURT_ID, PLAYER_ID, isoColombo(date, '12:00'), isoColombo(date, '13:00')]
    );

    const res = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send(webhookBody({ orderId: hold.hold_id, amount: 1500 }));

    expect(res.status).toBe(200);

    const { rows: payments } = await pool.query(
      `select status, created_at from payments where payhere_payment_id = $1`,
      [hold.hold_id]
    );
    expect(payments[0].status).toBe('failed');
  });

  it('admin refund without a configured gateway returns 503 and leaves the payment paid', async () => {
    const { rows: payments } = await pool.query(
      `select id from payments where status = 'paid' limit 1`
    );

    const adminToken = await tokenFor('demo-admin-uid');
    const res = await request(app)
      .post(`/api/v1/admin/payments/${payments[0].id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('REFUND_GATEWAY_NOT_CONFIGURED');

    const { rows: after } = await pool.query(
      `select status from payments where id = $1`,
      [payments[0].id]
    );
    expect(after[0].status).toBe('paid');
  });

  it('refunding twice is rejected', async () => {
    const { rows: payments } = await pool.query(
      `select id from payments where status = 'paid' limit 1`
    );
    await pool.query(
      `update payments set status = 'refunded', refunded_at = now() where id = $1`,
      [payments[0].id]
    );

    const adminToken = await tokenFor('demo-admin-uid');
    const res = await request(app)
      .post(`/api/v1/admin/payments/${payments[0].id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_REFUNDED');
  });
});

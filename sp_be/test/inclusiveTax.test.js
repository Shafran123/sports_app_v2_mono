const request = require('supertest');
const { SignJWT } = require('jose');
const crypto = require('crypto');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;
let TAXED_VENUE_ID;
let TAXED_COURT_ID;
let PLAIN_VENUE_ID;
let PLAIN_COURT_ID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

function payhereSig({ orderId, amount, statusCode }) {
  const secretMd5 = crypto.createHash('md5').update(process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret').digest('hex').toUpperCase();
  return crypto.createHash('md5').update(`TEST_MERCHANT_ID${orderId}${amount}LKR${statusCode}${secretMd5}`).digest('hex').toUpperCase();
}

async function setTax(rate) {
  await pool.query(
    `insert into platform_config (key, value, updated_at) values ('tax_rate', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(rate)]
  );
}

async function createVenue(name, venueTaxRate) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${OWNER_TOKEN}`)
    .send({
      name,
      address: '1 Tax Ave',
      city: 'Colombo',
      accepts_cash: true,
      venue_tax_rate: venueTaxRate,
      sports: ['badminton'],
      courts: [
        { name: 'Tax Court', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

async function checkoutCash(courtId, slotDate, startTime, endTime, key) {
  return request(app)
    .post('/api/v1/bookings/checkout')
    .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
    .send({
      court_id: courtId,
      start_at: isoColombo(slotDate, startTime),
      end_at: isoColombo(slotDate, endTime),
      idempotency_key: key,
      payment_method: 'cash'
    });
}

describe('inclusive tax across every checkout path (ADR-0021)', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
    await setTax(5);

    TAXED_VENUE_ID = await createVenue('Taxed Racket Club', 10);
    PLAIN_VENUE_ID = await createVenue('Plain Racket Club', 0);
    await request(app).post(`/api/v1/admin/venues/${TAXED_VENUE_ID}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(app).post(`/api/v1/admin/venues/${PLAIN_VENUE_ID}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const { rows: taxedRows } = await pool.query(`select id from courts where venue_id = $1`, [TAXED_VENUE_ID]);
    const { rows: plainRows } = await pool.query(`select id from courts where venue_id = $1`, [PLAIN_VENUE_ID]);
    TAXED_COURT_ID = taxedRows[0].id;
    PLAIN_COURT_ID = plainRows[0].id;
  });

  afterAll(async () => {
    await setTax(0);
  });

  it('cash booking on a venue with a venue tax snapshots both taxes out of the listed price', async () => {
    const date = colomboDate(1);
    const res = await checkoutCash(TAXED_COURT_ID, date, '10:00', '11:00', 'tax-cash-1');
    expect(res.status).toBe(201);
    const b = res.body.data.booking;
    expect(b.total_price).toBe(1000);          // listed price IS the total
    expect(b.tax_rate).toBe(5);
    expect(b.tax_amount).toBe(50);             // platform 5% of 1000
    expect(b.venue_tax_rate).toBe(10);
    expect(b.venue_tax_amount).toBe(100);      // venue 10% of 1000
  });

  it('the owner reading holds: with only a venue tax, 100 keeps 90', async () => {
    await setTax(0);
    const date = colomboDate(1);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: TAXED_COURT_ID,
        start_at: isoColombo(date, '11:00'),
        end_at: isoColombo(date, '12:00'),
        idempotency_key: 'tax-cash-2',
        payment_method: 'cash'
      });
    expect(res.status).toBe(201);
    const b = res.body.data.booking;
    expect(b.tax_rate).toBe(0);
    expect(b.tax_amount).toBe(0);
    expect(b.venue_tax_rate).toBe(10);
    expect(b.venue_tax_amount).toBe(100);
    expect(b.total_price).toBe(1000);
    await setTax(5);
  });

  it('a venue with no venue tax snapshots only the platform tax', async () => {
    const date = colomboDate(1);
    const res = await checkoutCash(PLAIN_COURT_ID, date, '14:00', '15:00', 'tax-cash-3');
    expect(res.status).toBe(201);
    const b = res.body.data.booking;
    expect(b.total_price).toBe(1000);
    expect(b.tax_amount).toBe(50);
    expect(b.venue_tax_amount).toBe(0);
  });

  it('event registration on a taxed venue snapshots the venue tax too', async () => {
    const start = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    const created = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ name: 'Taxed Social', sport: 'badminton', venue_id: TAXED_VENUE_ID, start_at: start, city: 'Colombo', capacity: 10, price: 2500 });
    const eventId = created.body.data.id;

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(2500);

    const { rows } = await pool.query(
      `select tax_rate, tax_amount, venue_tax_rate, venue_tax_amount from event_registrations where id = $1`,
      [res.body.data.registration_id]
    );
    expect(rows[0].tax_rate).toBe(5);
    expect(rows[0].tax_amount).toBe(125);
    expect(rows[0].venue_tax_rate).toBe(10);
    expect(rows[0].venue_tax_amount).toBe(250);
  });

  it('walk-in cash bookings split the venue-entered total the same way', async () => {
    const date = colomboDate(1);
    const res = await request(app)
      .post('/api/v1/business/bookings/manual')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        court_id: TAXED_COURT_ID,
        start_at: isoColombo(date, '16:00'),
        end_at: isoColombo(date, '17:00'),
        player_name: 'Walk-in',
        player_phone: '0771234567',
        amount: 1000
      });
    expect(res.status).toBe(201);
    const b = res.body.data;
    expect(b.total_price).toBe(1000);
    expect(b.tax_amount).toBe(50);
    expect(b.venue_tax_amount).toBe(100);
  });

  it('PayHere webhook booking copies the venue tax snapshots from the payment', async () => {
    // A dedicated court for this test so no other file's bookings can collide
    // with the slot in the shared test DB.
    const ownVenue = await createVenue(`Webhook Tax Club ${Date.now()}`, 10);
    await request(app).post(`/api/v1/admin/venues/${ownVenue}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows: ownCourtRows } = await pool.query(`select id from courts where venue_id = $1`, [ownVenue]);
    const ownCourtId = ownCourtRows[0].id;

    const date = colomboDate(2);
    const holdRes = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: ownCourtId,
        start_at: isoColombo(date, '18:00'),
        end_at: isoColombo(date, '19:00'),
        idempotency_key: `tax-webhook-${Date.now()}`,
      });
    const hold = holdRes.body.data;
    expect(hold.amount).toBe(1000);

    const secretMd5 = crypto.createHash('md5').update(process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret').digest('hex').toUpperCase();
    const md5sig = crypto.createHash('md5').update(`TEST_MERCHANT_ID${hold.hold_id}${hold.amount}LKR2${secretMd5}`).digest('hex').toUpperCase();
    const webhook = await request(app)
      .post('/api/v1/payments/payhere/notify')
      .type('form')
      .send({
        merchant_id: 'TEST_MERCHANT_ID',
        order_id: hold.hold_id,
        payhere_amount: String(hold.amount),
        payhere_currency: 'LKR',
        status_code: '2',
        md5sig
      });
    expect(webhook.status).toBe(200);

    const { rows } = await pool.query(
      `select total_price, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount from bookings where idempotency_key = $1`,
      [hold.idempotency_key]
    );
    expect(rows[0].total_price).toBe(1000);
    expect(rows[0].tax_rate).toBe(5);
    expect(rows[0].tax_amount).toBe(50);
    expect(rows[0].venue_tax_rate).toBe(10);
    expect(rows[0].venue_tax_amount).toBe(100);
  });
});
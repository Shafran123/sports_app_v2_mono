const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let VENUE_ID;
let PLAIN_COURT_ID;
let COURT_ID;
let CASH_VENUE_ID;
let CASH_COURT_ID;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

async function createVenue(ownerToken, opts = {}) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: opts.name || 'Cash Booking Venue',
      address: '3 Test Ave',
      city: 'Colombo',
      accepts_cash: opts.accepts_cash ?? false,
      sports: ['badminton'],
      courts: [
        { name: 'Cash Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res;
}

async function approveVenue(adminToken, venueId) {
  return request(app)
    .post(`/api/v1/admin/venues/${venueId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);
}

describe('cash bookings', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');

    // online-only venue
    const plain = await createVenue(OWNER_TOKEN, { name: 'Plain Venue', accepts_cash: false });
    VENUE_ID = plain.body.data.id;
    await approveVenue(ADMIN_TOKEN, VENUE_ID);
    const plainCourt = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    const { rows: plainRows } = plainCourt;
    PLAIN_COURT_ID = plainRows[0].id;

    // cash-accepting venue
    const cash = await createVenue(OWNER_TOKEN, { name: 'Cash Venue', accepts_cash: true });
    CASH_VENUE_ID = cash.body.data.id;
    await approveVenue(ADMIN_TOKEN, CASH_VENUE_ID);

    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [CASH_VENUE_ID]);
    CASH_COURT_ID = rows[0].id;
  });

  it('persists the accepts_cash opt-in on venue creation', () => {
    expect(CASH_VENUE_ID).toBeTruthy();
  });

  it('rejects cash checkout when the venue does not accept cash', async () => {
    const date = colomboDate(2);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: PLAIN_COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-no-optin'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CASH_NOT_ACCEPTED');
  });

  it('creates an instant confirmed cash booking with a QR token', async () => {
    const date = colomboDate(2);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-ok-1'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe('confirmed');
    expect(res.body.data.booking.payment_method).toBe('cash');
    expect(res.body.data.booking.qr_token).toBeTruthy();
    expect(res.body.data.payment_params).toBeUndefined();
  });

  it('still creates an online hold when payment_method is online (regression)', async () => {
    const date = colomboDate(3);
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        idempotency_key: 'cash-online-regression'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.hold_id).toBeTruthy();
    expect(res.body.data.payment_params.checkout_url).toBeTruthy();
  });

  it('rejects a cash checkout on an overlapping slot', async () => {
    const date = colomboDate(4);
    const first = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '14:00'),
        end_at: isoColombo(date, '15:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-overlap-a'
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '14:30'),
        end_at: isoColombo(date, '15:30'),
        payment_method: 'cash',
        idempotency_key: 'cash-overlap-b'
      });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('BOOKING_SLOT_UNAVAILABLE');
  });

  it('owner marks a cash booking paid, creating a cash payment row (idempotent)', async () => {
    const date = colomboDate(5);
    const checkout = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '16:00'),
        end_at: isoColombo(date, '17:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-pay-1'
      });
    const bookingId = checkout.body.data.booking.id;

    const mark = await request(app)
      .post(`/api/v1/business/bookings/${bookingId}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(mark.status).toBe(200);
    expect(mark.body.data.payment_method).toBe('cash');
    expect(mark.body.data.status).toBe('paid');

    const { rows } = await pool.query(
      `select payment_method, status from payments where booking_id = $1`,
      [bookingId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].payment_method).toBe('cash');
    expect(rows[0].status).toBe('paid');

    const again = await request(app)
      .post(`/api/v1/business/bookings/${bookingId}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(again.status).toBe(200);
    const { rows: after } = await pool.query(
      `select count(*)::int as n from payments where booking_id = $1`,
      [bookingId]
    );
    expect(after[0].n).toBe(1);
  });

  it('cancelling a cash booking releases the slot', async () => {
    const date = colomboDate(6);
    const checkout = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '09:00'),
        end_at: isoColombo(date, '10:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-cancel-1'
      });
    const bookingId = checkout.body.data.booking.id;

    const cancel = await request(app)
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('cancelled');

    const rebuy = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '09:00'),
        end_at: isoColombo(date, '10:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-cancel-2'
      });
    expect(rebuy.status).toBe(201);
  });

  it('cancelling a paid cash booking does not flag a manual refund', async () => {
    const date = colomboDate(7);
    const checkout = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '18:00'),
        end_at: isoColombo(date, '19:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-refund-flag-1'
      });
    const bookingId = checkout.body.data.booking.id;

    await request(app)
      .post(`/api/v1/business/bookings/${bookingId}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    const cancel = await request(app)
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(cancel.status).toBe(200);

    const { rows } = await pool.query(
      `select needs_manual_refund from payments where booking_id = $1`,
      [bookingId]
    );
    expect(rows[0].needs_manual_refund).toBeFalsy();
  });

  it('owner overview breaks out cash and online revenue from paid payments', async () => {
    const date = colomboDate(8);
    // cash booking, marked paid
    const cashCheckout = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '08:00'),
        end_at: isoColombo(date, '09:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-overview-cash'
      });
    await request(app)
      .post(`/api/v1/business/bookings/${cashCheckout.body.data.booking.id}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    // unpaid cash booking counts toward bookings but NOT revenue
    await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        payment_method: 'cash',
        idempotency_key: 'cash-overview-unpaid'
      });

    const overview = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data.cash_revenue).toBeGreaterThanOrEqual(1500);
    // revenue must equal the sum of its cash + online parts (payments are the source of truth)
    expect(overview.body.data.revenue).toBe(
      overview.body.data.cash_revenue + overview.body.data.online_revenue
    );
    expect(overview.body.data.bookings_count).toBeGreaterThanOrEqual(2);
  });
});
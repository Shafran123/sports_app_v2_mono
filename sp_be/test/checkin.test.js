const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const COURT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function isoFromNow(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

describe('check-in and manual bookings', () => {
  let ownerToken;

  beforeAll(async () => {
    ownerToken = await tokenFor('demo-owner-uid');
  });

  async function insertBooking(startAt, endAt) {
    const { rows: userRows } = await pool.query(
      `select id from users where firebase_uid = 'demo-player-uid'`
    );
    const { rows } = await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key, payment_method)
       values ($1, $2, $3, $4, 1500, 1500, 'confirmed', $5, 'cash')
       returning *`,
      [COURT_ID, userRows[0].id, startAt, endAt, `ci-${Math.random().toString(36).slice(2)}`]
    );
    return rows[0];
  }

  it('owner can check in a booking within the time window', async () => {
    const booking = await insertBooking(isoFromNow(-0.75), isoFromNow(-0.25));

    const res = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.checked_in_at).toBeTruthy();
  });

  it('check-in fails once the slot ended more than 30 minutes ago', async () => {
    const booking = await insertBooking(isoFromNow(-3), isoFromNow(-2));

    const res = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECK_IN_WINDOW_VIOLATION');
  });

  it('check-in fails for an already checked-in booking', async () => {
    const booking = await insertBooking(isoFromNow(0), isoFromNow(1));
    await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const res = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
  });

  it('a player cannot check in bookings', async () => {
    const booking = await insertBooking(isoFromNow(6), isoFromNow(7));
    const playerToken = await tokenFor('demo-player-uid');

    const res = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/check-in`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(res.status).toBe(403);
  });

  it('owner can create a manual cash booking that blocks the slot', async () => {
    const date = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    const startAt = new Date(`${dateStr}T20:00:00+05:30`).toISOString();
    const endAt = new Date(`${dateStr}T21:00:00+05:30`).toISOString();

    const res = await request(app)
      .post('/api/v1/business/bookings/manual')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        court_id: COURT_ID,
        start_at: startAt,
        end_at: endAt,
        player_name: 'Walk-in Customer',
        player_phone: '0771234567',
        amount: 1500
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.payment_method).toBe('cash');
    expect(res.body.data.player_name).toBe('Walk-in Customer');

    const { rows: payments } = await pool.query(
      `select * from payments where booking_id = $1`,
      [res.body.data.id]
    );
    // A walk-in's cash payment is born `due` at creation (ADR-0037).
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('due');
    expect(payments[0].payment_method).toBe('cash');

    const avail = await request(app).get(
      `/api/v1/venues/11111111-1111-1111-1111-111111111111/availability?date=${dateStr}`
    );
    const court = avail.body.data.courts.find((c) => c.court_id === COURT_ID);
    const slot = court.slots.find((s) => s.start_at === startAt);
    expect(slot.state).toBe('booked');
  });

  it('manual booking on a taken slot fails', async () => {
    const date = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    const startAt = new Date(`${dateStr}T20:00:00+05:30`).toISOString();
    const endAt = new Date(`${dateStr}T21:00:00+05:30`).toISOString();

    const res = await request(app)
      .post('/api/v1/business/bookings/manual')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        court_id: COURT_ID,
        start_at: startAt,
        end_at: endAt,
        player_name: 'Second Customer',
        amount: 1500
      });

    expect(res.status).toBe(409);
  });
});

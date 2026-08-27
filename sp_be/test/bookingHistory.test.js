const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_TOKEN;
let OWNER_TOKEN;
let PLAYER_ID;
let COURT_ID;

function iso(daysFromNow, hoursFromNow = 0) {
  // Minutes of jitter so geometry-relative bookings from other suites (same
  // "now + N hours" pattern on the shared seed court) cannot collide under
  // the bookings_no_overlap exclusion constraint.
  const jitter = Math.floor(Math.random() * 50);
  return new Date(Date.now() + daysFromNow * 24 * 3600 * 1000 + hoursFromNow * 3600 * 1000 + jitter * 60000).toISOString();
}

async function insertBooking(startAt, endAt, status = 'confirmed', idemKey = null) {
  const { rows } = await pool.query(
    `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key)
     values ($1, $2, $3, $4, 1500, 1500, $5, $6)
     returning *`,
    [COURT_ID, PLAYER_ID, startAt, endAt, status, idemKey || `bk-${Math.random().toString(36).slice(2)}`]
  );
  return rows[0];
}

describe('booking history and cancellation', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    PLAYER_ID = rows[0].id;
    const courtRows = await pool.query(
      `select id from courts where venue_id = '11111111-1111-1111-1111-111111111111' order by name limit 1`
    );
    COURT_ID = courtRows.rows[0].id;
  });

  it('lists the player bookings', async () => {
    await insertBooking(iso(2), iso(2, 1));
    await insertBooking(iso(-2), iso(-2, 1), 'completed');

    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0]).toHaveProperty('court_name');
    expect(res.body.data[0]).toHaveProperty('venue_name');
  });

  it('cancelling more than 24h ahead refunds 100%', async () => {
    const booking = await insertBooking(iso(3), iso(3, 1));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled_by_user');
    expect(res.body.data.refund_amount).toBe(1500);
    expect(res.body.data.refund_pct).toBe(100);
  });

  it('cancelling 12-24h ahead refunds 50%', async () => {
    const booking = await insertBooking(iso(0, 20), iso(0, 21));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.refund_pct).toBe(50);
    expect(res.body.data.refund_amount).toBe(750);
  });

  it('cancelling less than 12h ahead refunds 0%', async () => {
    const booking = await insertBooking(iso(0, 5), iso(0, 6));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.refund_amount).toBe(0);
  });

  it('double cancellation fails', async () => {
    const booking = await insertBooking(iso(4), iso(4, 1));

    await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(409);
  });

  it('a player cannot cancel another player booking', async () => {
    const booking = await insertBooking(iso(5), iso(5, 1));
    const otherPlayer = await tokenFor('other-player-uid');

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${otherPlayer}`);

    expect(res.status).toBe(403);
  });

  it('the venue owner can cancel a booking at their venue', async () => {
    const booking = await insertBooking(iso(6), iso(6, 1));

    const res = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled_by_owner');
  });

  it('owner sees their venue bookings for a date', async () => {
    const startAt = iso(7);
    await insertBooking(startAt, iso(7, 1));

    const date = startAt.slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/business/bookings?date=${date}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('player_name');
  });

  it('owner sees daily overview revenue', async () => {
    const date = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const startAt = iso(8);
    const booking = await insertBooking(startAt, iso(8, 1));
    await pool.query(
      `insert into payments (user_id, booking_id, amount, currency, status, payment_method, paid_at)
       values ($1, $2, $3, 'LKR', 'paid', 'cash', now())`,
      [PLAYER_ID, booking.id, 1500]
    );

    const res = await request(app)
      .get(`/api/v1/business/overview?date=${date}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.bookings_count).toBeGreaterThanOrEqual(1);
    expect(res.body.data.revenue).toBeGreaterThanOrEqual(1500);
  });

  it('owner can mark a past booking as no-show', async () => {
    const booking = await insertBooking(iso(-1, 2), iso(-1, 3));

    const res = await request(app)
      .post(`/api/v1/business/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('no_show');
  });

  it('cancelled booking releases the slot', async () => {
    const date = new Date(Date.now() + 9 * 24 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    const startAt = new Date(`${dateStr}T10:00:00+05:30`).toISOString();
    const endAt = new Date(`${dateStr}T11:00:00+05:30`).toISOString();

    const booking = await insertBooking(startAt, endAt);
    await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    const avail = await request(app).get(
      `/api/v1/venues/11111111-1111-1111-1111-111111111111/availability?date=${dateStr}`
    );
    const court = avail.body.data.courts.find((c) => c.court_id === COURT_ID);
    const slot = court.slots.find((s) => s.start_at === startAt);
    expect(slot.state).toBe('available');
  });
});

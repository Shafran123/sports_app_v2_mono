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
let COURT_IDS = [];
const VENUE_ID = '11111111-1111-1111-1111-111111111111';
let nextCourt = 0;

function iso(daysFromNow, hoursFromNow = 0, minutes = 0) {
  const jitter = Math.floor(Math.random() * 50);
  return new Date(Date.now() + daysFromNow * 24 * 3600 * 1000 + hoursFromNow * 3600 * 1000 + minutes * 60000 + jitter * 60000).toISOString();
}

async function insertBooking(startAt, endAt) {
  // Rotate courts so geometrically-close bookings never collide under the
  // bookings_no_overlap exclusion constraint.
  const courtId = COURT_IDS[nextCourt++ % COURT_IDS.length];
  const { rows } = await pool.query(
    `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key)
     values ($1, $2, $3, $4, 1500, 1500, 'confirmed', $5)
     returning *`,
    [courtId, PLAYER_ID, startAt, endAt, `cutoff-${Math.random().toString(36).slice(2)}`]
  );
  return rows[0];
}

describe('venue cancel cutoff (Cancel Cutoff setting)', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    PLAYER_ID = rows[0].id;
    const courtRows = await pool.query(
      `select id from courts where venue_id = $1 order by name limit 5`,
      [VENUE_ID]
    );
    COURT_IDS = courtRows.rows.map((r) => r.id);
    // Reset the seed venue's cutoff to the default for this suite.
    await pool.query(`update venues set cancel_cutoff_hours = 2 where id = $1`, [VENUE_ID]);
  });

  it('rejects a player self-cancel inside the cutoff', async () => {
    const booking = await insertBooking(iso(0, 1), iso(0, 2));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANCEL_CUTOFF');
    expect(res.body.error.message).toContain('contact the venue');

    const { rows } = await pool.query(`select status from bookings where id = $1`, [booking.id]);
    expect(rows[0].status).toBe('confirmed');
  });

  it('allows a player self-cancel beyond the cutoff', async () => {
    const booking = await insertBooking(iso(0, 6), iso(0, 7));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    // 6h before start: beyond the 2h cutoff, inside the 12h zero-refund tier.
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled_by_user');
    expect(res.body.data.refund_amount).toBe(0);
  });

  it('an owner may cancel inside the cutoff', async () => {
    const booking = await insertBooking(iso(0, 1), iso(0, 2));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled_by_owner');
  });

  it('a zero cutoff disables the self-cancel gate', async () => {
    await pool.query(`update venues set cancel_cutoff_hours = 0 where id = $1`, [VENUE_ID]);
    const booking = await insertBooking(iso(1, 3), iso(1, 4));

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    await pool.query(`update venues set cancel_cutoff_hours = 2 where id = $1`, [VENUE_ID]);
  });

  it('the owner can set the cutoff from venue settings', async () => {
    const res = await request(app)
      .patch(`/api/v1/venues/${VENUE_ID}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ cancel_cutoff_hours: 24 });

    expect(res.status).toBe(200);
    expect(res.body.data.cancel_cutoff_hours).toBe(24);
    await pool.query(`update venues set cancel_cutoff_hours = 2 where id = $1`, [VENUE_ID]);
  });

  it('rejects an invalid cutoff value', async () => {
    const res = await request(app)
      .patch(`/api/v1/venues/${VENUE_ID}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ cancel_cutoff_hours: 2.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENUE_VALIDATION');
  });
});
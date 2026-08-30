const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const VENUE_ID = '11111111-1111-1111-1111-111111111111';

describe('widget bookings scope — a fresh booking must appear in the widget list', () => {
  let PLAYER_TOKEN;
  let PLAYER_ID;
  let COURT_ID;

  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    PLAYER_ID = rows[0].id;
    const courtRows = await pool.query(
      `select id from courts where venue_id = $1 order by name limit 1`,
      [VENUE_ID]
    );
    COURT_ID = courtRows.rows[0].id;
  });

  it('returns venue_id on the upcoming bookings so the widget can scope to its venue', async () => {
    // Far-future on a rotated court: other suites book the seed venue at
    // now + a few days, so +10 days keeps this out of the bookings_no_overlap
    // exclusion constraint regardless of run order.
    const jitter = Math.floor(Math.random() * 50);
    const days = 10;
    const start = new Date(Date.now() + days * 24 * 3600 * 1000 + jitter * 60000).toISOString();
    const end = new Date(Date.now() + days * 24 * 3600 * 1000 + 3600 * 1000 + jitter * 60000).toISOString();
    const courtRows = await pool.query(
      `select id from courts where venue_id = $1 order by name limit 2`,
      [VENUE_ID]
    );
    COURT_ID = courtRows.rows[1]?.id || COURT_ID;
    await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key, payment_method) values ($1, $2, $3, $4, 1500, 1500, 'confirmed', $5, 'cash')`,
      [COURT_ID, PLAYER_ID, start, end, `scope-${Date.now()}`]
    );

    const res = await request(app)
      .get('/api/v1/bookings?status=upcoming')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    // The widget (widget-bookings.tsx) filters rows by b.venue_id === venue.id.
    // Without venue_id in the payload the filter matches nothing -> empty list.
    const scoped = res.body.data.filter((b) => b.venue_id === VENUE_ID);
    expect(scoped.length).toBeGreaterThan(0);
  });

  it('venue_id query param returns only that venue\'s upcoming bookings (server-scoped widget list)', async () => {
    // Book on a second venue of the same player so the parse can be strict.
    const courtRows = await pool.query(
      `select c.id, c.venue_id from courts c order by c.name limit 3`
    );
    const otherCourt = courtRows.rows.find((r) => r.venue_id !== VENUE_ID);
    const jitter = Math.floor(Math.random() * 50);
    const days = 11;
    const start = new Date(Date.now() + days * 24 * 3600 * 1000 + jitter * 60000).toISOString();
    const end = new Date(Date.now() + days * 24 * 3600 * 1000 + 3600 * 1000 + jitter * 60000).toISOString();
    if (otherCourt) {
      await pool.query(
        `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, idempotency_key, payment_method) values ($1, $2, $3, $4, 1500, 1500, 'confirmed', $5, 'cash')`,
        [otherCourt.id, PLAYER_ID, start, end, `scope-other-${Date.now()}`]
      );
    }

    const res = await request(app)
      .get(`/api/v1/bookings?status=upcoming&venue_id=${VENUE_ID}`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((b) => b.venue_id === VENUE_ID)).toBe(true);
  });
});
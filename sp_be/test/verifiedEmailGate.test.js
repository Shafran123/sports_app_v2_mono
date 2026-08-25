const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
// The player is an email/password account: the ID token deliberately carries
// email_verified: false, so the always-on gate must block (unlike Google
// tokens, which attest email_verified: true).
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: false })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);

describe('verified email booking gate (always-on, flag-independent)', () => {
  let PLAYER_TOKEN;
  let PLAYER_ID;
  let COURT_ID;

  beforeAll(async () => {
    const uid = `gate-email-${Date.now()}`;
    PLAYER_TOKEN = await tokenFor(uid);
    // First authenticated call upserts the player row (middleware).
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    const { rows: meRows } = await pool.query(`select id from users where firebase_uid = $1`, [uid]);
    PLAYER_ID = meRows[0].id;
    const courtRows = await pool.query(
      `select id from courts where venue_id = '11111111-1111-1111-1111-111111111111' order by name limit 1`
    );
    COURT_ID = courtRows.rows[0].id;
    // Reset the player: verified phone, unverified email (gate must block).
    await pool.query(`update users set phone_verified_at = now(), email_verified_at = null where id = $1`, [PLAYER_ID]);
  });

  // A 10:00–11:00 Colombo slot 3 days out always fits the seed venue's
  // opening windows — no jitter, so geometry cannot collide either.
  async function checkoutAttempt() {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 3);
    const dateStr = day.toISOString().slice(0, 10);
    const start = `${dateStr}T04:30:00.000Z`; // 10:00 Colombo
    const end = `${dateStr}T05:30:00.000Z`;   // 11:00 Colombo
    return request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: start,
        end_at: end,
        idempotency_key: `email-gate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        payment_method: 'cash'
      });
  }

  it('blocks checkout when the email is unverified, even with a verified phone', async () => {
    const res = await checkoutAttempt();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERIFIED_EMAIL_REQUIRED');
  });

  it('allows checkout once the email is verified', async () => {
    await pool.query(`update users set email_verified_at = now() where id = $1`, [PLAYER_ID]);
    const res = await checkoutAttempt();
    expect(res.status).toBe(201);
    expect(res.body.data.booking?.status).toBe('confirmed');
    await pool.query(`update users set email_verified_at = null where id = $1`, [PLAYER_ID]);
  });
});
const request = require('supertest');
const { SignJWT } = require('jose');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const PLAYER_TOKEN = tokenFor('demo-player-uid');
let playerId;
let token;

async function setAccountStatus({ isSuspended, status }) {
  await pool.query(
    `update users set is_suspended = $1, status = $2 where id = $3`,
    [isSuspended, status, playerId]
  );
}

describe('account ban & suspension enforcement (player routes)', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    const { rows } = await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`);
    playerId = rows[0].id;
    token = await PLAYER_TOKEN;
  });

  afterAll(async () => {
    await setAccountStatus({ isSuspended: false, status: 'active' });
  });

  it('lets an active player through (200)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blocks a suspended player from mutating routes (403 ACCOUNT_SUSPENDED)', async () => {
    await setAccountStatus({ isSuspended: true, status: 'active' });
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ court_id: '00000000-0000-0000-0000-000000000000', start_at: '2099-01-01T10:00:00+05:30', end_at: '2099-01-01T11:00:00+05:30', idempotency_key: 'suspended-checkout' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    await setAccountStatus({ isSuspended: false, status: 'active' });
  });

  it('still lets a suspended player read their own data (GET)', async () => {
    await setAccountStatus({ isSuspended: true, status: 'active' });
    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    await setAccountStatus({ isSuspended: false, status: 'active' });
  });

  it('blocks a banned player from everything (403 ACCOUNT_BANNED)', async () => {
    await setAccountStatus({ isSuspended: false, status: 'banned' });
    const read = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('ACCOUNT_BANNED');

    const mutate = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ court_id: '00000000-0000-0000-0000-000000000000' });
    expect(mutate.status).toBe(403);
    expect(mutate.body.error.code).toBe('ACCOUNT_BANNED');
    await setAccountStatus({ isSuspended: false, status: 'active' });
  });
});

describe('booking read authorization & QR token disclosure', () => {
  let venueA;
  let courtA;
  let venueB;
  let courtB;
  let ownerBToken;
  let ownerAToken;
  let playerToken;
  let bookingId;

  async function createVenue(ownerToken, name) {
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name,
        address: `${Math.random().toString(36).slice(2, 8)} ${name} Rd`,
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: `${name} Court`, sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    const venueId = created.body.data.id;
    await request(app)
      .post(`/api/v1/admin/venues/${venueId}/approve`)
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [venueId]);
    return { venueId, courtId: rows[0].id };
  }

  beforeAll(async () => {
    ownerAToken = await tokenFor('demo-owner-uid');
    playerToken = await tokenFor('demo-player-uid');
    const ownerB = `sec-owner-b-${Date.now()}`;
    await pool.query(
      `insert into users (firebase_uid, email, name, role, onboarding_state) values ($1, $2, $3, 'venue_owner', 'accepted') on conflict (firebase_uid) do nothing`,
      [ownerB, `${ownerB}@spots.lk`, 'Owner B']
    );
    ownerBToken = await tokenFor(ownerB);

    venueA = await createVenue(ownerAToken, `Sec Venue A ${Date.now()}`);
    venueB = await createVenue(ownerBToken, `Sec Venue B ${Date.now()}`);
  });

  async function insertBookingFor(courtId, qrToken, hour = 10) {
    const user = await pool.query(`select id from users where firebase_uid = $1`, ['demo-player-uid']);
    const start = `2099-01-01T${String(hour).padStart(2, '0')}:00:00+05:30`;
    const end = `2099-01-01T${String(hour + 1).padStart(2, '0')}:00:00+05:30`;
    const { rows } = await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, qr_token, idempotency_key)
       values ($1, $2, $3, $4, 1000, 1000, 'confirmed', $5, $6)
       returning *`,
      [courtId, user.rows[0].id, start, end, qrToken, `sec-${qrToken}`]
    );
    return rows[0];
  }

  it('owner of a different venue cannot read a booking at another venue (403)', async () => {
    const booking = await insertBookingFor(venueA.courtId, 'tok-cross-a');
    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(res.status).toBe(403);
  });

  it('the owning venue owner can read the booking but never sees the QR token', async () => {
    const booking = await insertBookingFor(venueA.courtId, 'tok-own-a', 12);
    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.qr_token).toBeUndefined();
    expect(res.body.data.idempotency_key).toBeUndefined();
  });

  it('the player sees the QR token on their own booking', async () => {
    const booking = await insertBookingFor(venueA.courtId, 'tok-own-player', 14);
    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.qr_token).toBe('tok-own-player');
  });

  it('list endpoints never return qr_token', async () => {
    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.qr_token).toBeUndefined();
      expect(row.idempotency_key).toBeUndefined();
    }
  });

  it('business bookings list never returns qr_token', async () => {
    const res = await request(app)
      .get('/api/v1/business/bookings')
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(row.qr_token).toBeUndefined();
      expect(row.idempotency_key).toBeUndefined();
    }
  });
});

describe('hold abuse caps', () => {
  let holdPlayerToken;
  let courtId;

  beforeAll(async () => {
    process.env.HOLD_LIMIT = '3';
  });

  afterAll(async () => {
    delete process.env.HOLD_LIMIT;
  });

  async function checkout(slot, key, court = courtId) {
    const date = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    return request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${holdPlayerToken}`)
      .send({
        court_id: court,
        start_at: `${day}T${String(slot).padStart(2, '0')}:00:00+05:30`,
        end_at: `${day}T${String(slot + 1).padStart(2, '0')}:00:00+05:30`,
        idempotency_key: key
      });
  }

  beforeAll(async () => {
    const uid = `hold-player-${Date.now()}`;
    await pool.query(
      `insert into users (firebase_uid, email, name, phone, phone_verified_at)
       values ($1, $2, $3, '+94771234001', now())
       on conflict (firebase_uid) do nothing`,
      [uid, `${uid}@spots.lk`, 'Hold Player']
    );
    holdPlayerToken = await tokenFor(uid);

    const owner = await tokenFor('demo-owner-uid');
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${owner}`)
      .send({
        name: `Hold Cap Venue ${Date.now()}`,
        address: '9 Hold Ln',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: 'Hold Court', sport: 'badminton', price_per_slot: 500, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    await request(app)
      .post(`/api/v1/admin/venues/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [created.body.data.id]);
    courtId = rows[0].id;
  });

  it('rejects a second hold on the same court overlapping my own hold (409 SLOT_HELD)', async () => {
    const first = await checkout(20, 'hold-overlap-a');
    expect(first.status).toBe(201);
    const overlap = await checkout(20, 'hold-overlap-b');
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('SLOT_HELD');
  });

  it('allows up to 3 concurrent holds per player (including the overlap hold)', async () => {
    expect((await checkout(10, 'hold-1')).status).toBe(201);
    expect((await checkout(12, 'hold-2')).status).toBe(201);
  });

  it('rejects a hold beyond the 3 concurrent cap (409 HOLD_LIMIT_REACHED)', async () => {
    const res = await checkout(14, 'hold-3');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOLD_LIMIT_REACHED');
  });
});

describe('security headers & CORS lock', () => {
  it('sends security headers from helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('never answers cross-origin requests from outside the configured origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    // cors() with a string origin sets this header unconditionally, but the
    // browser rejects it because it does not match the request's Origin — the
    // dangerous case is echoing the attacker's own origin back.
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it('answers the configured origin', async () => {
    const res = await request(app).get('/health').set('Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe(process.env.FRONTEND_URL || 'http://localhost:3000');
  });
});
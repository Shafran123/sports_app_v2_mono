const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let VENUE_ID;
let COURT_ID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

async function slotsFor(date) {
  const res = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability?date=${date}`);
  expect(res.status).toBe(200);
  const court = res.body.data.courts.find((c) => c.court_id === COURT_ID);
  return Object.fromEntries(court.slots.map((s) => [new Date(s.start_at).getTime(), s.state]));
}

async function getUserId() {
  const { rows } = await pool.query(
    `select id from users where firebase_uid = 'demo-player-uid'`
  );
  return rows[0].id;
}

describe('availability engine', () => {
  beforeAll(async () => {
    const ownerToken = await tokenFor('demo-owner-uid');
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Availability Test Venue',
        address: '1 Test Ave',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [
          { name: 'Test Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });

    VENUE_ID = submitted.body.data.id;
    const adminToken = await tokenFor('demo-admin-uid');
    await request(app)
      .post(`/api/v1/admin/venues/${VENUE_ID}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Per-venue advance horizon (0 = unlimited): pin 14 days so the
    // beyond-window assertions below stay meaningful.
    await pool.query(`update venues set advance_days = 14 where id = $1`, [VENUE_ID]);

    const { rows } = await pool.query(
      `select id from courts where venue_id = $1`,
      [VENUE_ID]
    );
    COURT_ID = rows[0].id;
  });

  it('returns slots within opening hours', async () => {
    const date = colomboDate(2);
    const res = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability?date=${date}`);
    expect(res.status).toBe(200);

    const court = res.body.data.courts.find((c) => c.court_id === COURT_ID);
    expect(court.slots.length).toBe(17);
    expect(new Date(court.slots[0].start_at).getTime())
      .toBe(new Date(isoColombo(date, '06:00')).getTime());
    expect(new Date(court.slots.at(-1).start_at).getTime())
      .toBe(new Date(isoColombo(date, '22:00')).getTime());
  });

  it('rejects an invalid date', async () => {
    const res = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability?date=not-a-date`);
    expect(res.status).toBe(400);
  });

  it('requires a date', async () => {
    const res = await request(app).get(`/api/v1/venues/${VENUE_ID}/availability`);
    expect(res.status).toBe(400);
  });

  it('marks slots overlapping a confirmed booking as booked', async () => {
    const date = colomboDate(6);
    const userId = await getUserId();
    await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, payment_method) values ($1, $2, $3, $4, 1500, 1500, 'confirmed', 'cash')`,
      [COURT_ID, userId, isoColombo(date, '08:00'), isoColombo(date, '09:00')]
    );

    const states = await slotsFor(date);
    expect(states[new Date(isoColombo(date, '08:00')).getTime()]).toBe('booked');
    expect(states[new Date(isoColombo(date, '07:00')).getTime()]).toBe('available');
    expect(states[new Date(isoColombo(date, '09:00')).getTime()]).toBe('available');
  });

  it('marks slots under an unexpired hold as held, expired holds as available', async () => {
    const date = colomboDate(7);
    const userId = await getUserId();
    await pool.query(
      `insert into holds (court_id, user_id, start_at, end_at, expires_at, idempotency_key)
       values ($1, $2, $3, $4, now() + interval '5 minutes', 'avail-live-7')`,
      [COURT_ID, userId, isoColombo(date, '10:00'), isoColombo(date, '11:00')]
    );
    await pool.query(
      `insert into holds (court_id, user_id, start_at, end_at, expires_at, idempotency_key)
       values ($1, $2, $3, $4, now() - interval '1 minute', 'avail-expired-7')`,
      [COURT_ID, userId, isoColombo(date, '12:00'), isoColombo(date, '13:00')]
    );

    const states = await slotsFor(date);
    expect(states[new Date(isoColombo(date, '10:00')).getTime()]).toBe('held');
    expect(states[new Date(isoColombo(date, '12:00')).getTime()]).toBe('available');
  });

  it('marks blocked slots as blocked', async () => {
    const date = colomboDate(8);
    await pool.query(
      `insert into blocks (court_id, start_at, end_at, reason)
       values ($1, $2, $3, 'Maintenance')`,
      [COURT_ID, isoColombo(date, '14:00'), isoColombo(date, '16:00')]
    );

    const states = await slotsFor(date);
    expect(states[new Date(isoColombo(date, '14:00')).getTime()]).toBe('blocked');
    expect(states[new Date(isoColombo(date, '15:00')).getTime()]).toBe('blocked');
    expect(states[new Date(isoColombo(date, '13:00')).getTime()]).toBe('available');
    expect(states[new Date(isoColombo(date, '16:00')).getTime()]).toBe('available');
  });

  it('marks past slots as past and beyond-advance-window slots as outside_window', async () => {
    const pastDate = colomboDate(-1);
    const past = await slotsFor(pastDate);
    expect(Object.values(past).every((s) => s === 'past')).toBe(true);

    const farDate = colomboDate(20);
    const far = await slotsFor(farDate);
    expect(Object.values(far).every((s) => s === 'outside_window')).toBe(true);
  });
});

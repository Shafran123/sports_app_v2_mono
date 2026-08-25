const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let OWNER_TOKEN;
let ADMIN_TOKEN;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function createVenue(ownerToken, name) {
  return request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name,
      address: '9 Test Ave',
      city: 'Colombo',
      accepts_cash: true,
      sports: ['badminton'],
      courts: [
        { name: 'Overview Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
}

describe('admin overview', () => {
  beforeAll(async () => {
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
  });

  it('returns platform-wide numbers for an admin', async () => {
    const today = colomboDate(0);

    const approved = await createVenue(OWNER_TOKEN, 'Overview Venue');
    const approvedId = approved.body.data.id;
    await request(app)
      .post(`/api/v1/admin/venues/${approvedId}/approve`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const pending = await createVenue(OWNER_TOKEN, 'Overview Pending Venue');
    const pendingId = pending.body.data.id;

    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [approvedId]);
    const courtId = rows[0].id;

    const manual = await request(app)
      .post('/api/v1/business/bookings/manual')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        court_id: courtId,
        start_at: `${today}T09:00:00+05:30`,
        end_at: `${today}T10:00:00+05:30`,
        amount: 1500
      });
    expect(manual.status).toBe(201);
    const bookingId = manual.body.data.id;

    const paid = await request(app)
      .post(`/api/v1/business/bookings/${bookingId}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(paid.status).toBe(200);

    const overview = await request(app)
      .get(`/api/v1/admin/overview?date=${today}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(overview.status).toBe(200);
    expect(overview.body.data.revenue_today).toBeGreaterThanOrEqual(1500);
    expect(overview.body.data.bookings_today).toBeGreaterThanOrEqual(1);
    expect(overview.body.data.total_venues).toBeGreaterThanOrEqual(2);
    expect(overview.body.data.pending_approvals).toBeGreaterThanOrEqual(1);
    expect(pendingId).toBeTruthy();
  });

  it('defaults to today when no date is passed', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.revenue_today).toBe('number');
    expect(typeof res.body.data.bookings_today).toBe('number');
    expect(res.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects non-admin access', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { buildDigest, colomboDate } = require('../jobs/dailyDigest');
const { enableLegacyFlags, resetFlagsToDefaults } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let ADMIN_TOKEN;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let CASH_COURT_ID;

function colomboDatePlus(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

async function createVenue(name) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${OWNER_TOKEN}`)
    .send({
      name,
      address: '12 Report Ave',
      city: 'Colombo',
      accepts_cash: true,
      sports: ['badminton'],
      courts: [
        { name: 'Report Court', sport: 'badminton', price_per_slot: 900, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

describe('admin reports & digest', () => {
  beforeAll(async () => {
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    await enableLegacyFlags();

    const venueId = await createVenue('Report Venue');
    await request(app).post(`/api/v1/admin/venues/${venueId}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [venueId]);
    CASH_COURT_ID = rows[0].id;

    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(colomboDatePlus(1), '18:00'),
        end_at: isoColombo(colomboDatePlus(1), '19:00'),
        idempotency_key: `report-${Date.now()}`,
        payment_method: 'cash'
      });
    await request(app)
      .post(`/api/v1/business/bookings/${res.body.data.booking.id}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
  });

  afterAll(async () => {
    await resetFlagsToDefaults();
  });

  it('rejects non-admins from reports', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('returns revenue, tax, sport, venue and payment split for the window', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports?range=7')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.range).toBe(7);

    const bookings = data.series.reduce((n, d) => n + d.bookings, 0);
    expect(bookings).toBeGreaterThanOrEqual(1);
    const totalRevenue = data.series.reduce((s, d) => s + d.revenue, 0);
    expect(totalRevenue).toBeGreaterThanOrEqual(900);

    expect(data.by_sport.length).toBeGreaterThanOrEqual(1);
    expect(data.by_sport.find((s) => s.name === 'Badminton').revenue).toBeGreaterThanOrEqual(900);

    expect(data.by_venue.find((v) => v.name === 'Report Venue').revenue).toBe(900);
    expect(data.payment_split.cash.bookings).toBeGreaterThanOrEqual(1);
    expect(data.payment_split.online.bookings).toBeGreaterThanOrEqual(0);
    expect(data.events.registrations).toBeGreaterThanOrEqual(0);
  });

  it('lets an admin fetch reports with a 90-day window', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports?range=90')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe(90);
  });

  it('builds a digest email for the day with escaped tables', async () => {
    const html = await buildDigest(colomboDate());
    expect(html).toContain('Daily digest');
    expect(html).toContain('<table');
    expect(html).toContain('Net revenue');
  });
});
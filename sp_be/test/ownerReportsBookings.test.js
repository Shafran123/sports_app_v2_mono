const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { buildDigest } = require('../jobs/dailyDigest');
const { enableLegacyFlags, resetFlagsToDefaults } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let ADMIN_TOKEN;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let VENUE_ID;
let COURT_ID;

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
      address: '9 Report Rd',
      city: 'Colombo',
      accepts_cash: true,
      venue_tax_rate: 10,
      sports: ['badminton'],
      courts: [
        { name: 'Owner Court', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

async function makeCashBooking(date, time, key) {
  const res = await request(app)
    .post('/api/v1/bookings/checkout')
    .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
    .send({
      court_id: COURT_ID,
      start_at: isoColombo(date, time),
      end_at: isoColombo(date, String(Number(time.slice(0, 2)) + 1).padStart(2, '0') + ':00'),
      idempotency_key: key,
      payment_method: 'cash'
    });
  await request(app)
    .post(`/api/v1/business/bookings/${res.body.data.booking.id}/mark-paid`)
    .set('Authorization', `Bearer ${OWNER_TOKEN}`);
  return res.body.data.booking;
}

describe('owner reports, filtered bookings & tax split (T3-T5)', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('tax_rate', '5'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    PLAYER_TOKEN = await tokenFor('demo-player-uid');

    VENUE_ID = await createVenue('Owner Report Venue');
    await request(app).post(`/api/v1/admin/venues/${VENUE_ID}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURT_ID = rows[0].id;

    await makeCashBooking(colomboDatePlus(1), '10:00', 'owner-rep-1');
    await makeCashBooking(colomboDatePlus(1), '11:00', 'owner-rep-2');
  });

  afterAll(async () => {
    await resetFlagsToDefaults();
  });

  it('owner reports return a series with the venue tax split out', async () => {
    const res = await request(app)
      .get('/api/v1/business/reports?range=7')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.range).toBe(7);
    const totalRevenue = data.series.reduce((s, d) => s + d.revenue, 0);
    const totalVenueTax = data.series.reduce((s, d) => s + d.venue_tax, 0);
    const totalPlatformTax = data.series.reduce((s, d) => s + d.tax, 0);
    // At minimum this file created 2 x 1000 with 5% platform + 10% venue tax
    // (the shared test DB may also hold other files' demo-owner bookings).
    expect(totalRevenue).toBeGreaterThanOrEqual(1600);
    expect(totalPlatformTax).toBeGreaterThanOrEqual(100);
    expect(totalVenueTax).toBeGreaterThanOrEqual(200);
    expect(data.by_venue.find((v) => v.name === 'Owner Report Venue').revenue).toBeGreaterThanOrEqual(1600);
    expect(data.payment_split.cash.bookings).toBeGreaterThanOrEqual(2);
  });

  it('owner reports can be filtered to a single venue', async () => {
    const res = await request(app)
      .get(`/api/v1/business/reports?range=7&venue_id=${VENUE_ID}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.by_venue.map((v) => v.id)).toContain(VENUE_ID);
  });

  it('owner reports never include another owner venues', async () => {
    // A second owner (onboarded directly) with a venue + paid booking.
    const OTHER_UID = `other-owner-${Date.now()}`;
    const otherOwnerToken = await tokenFor(OTHER_UID);
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ($1, $2, 'Other Owner', 'venue_owner', 'active', 'accepted')`,
      [OTHER_UID, `${OTHER_UID}@example.com`]
    );

    const otherVenue = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${otherOwnerToken}`)
      .send({
        name: 'Other Owners Club',
        address: '77 Other Rd',
        city: 'Kandy',
        accepts_cash: true,
        sports: ['badminton'],
        courts: [{ name: 'Other Court', sport: 'badminton', price_per_slot: 500, slot_duration_min: 60, capacity: 4, is_indoor: true }],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '22:00' }))
      });
    expect(otherVenue.status).toBe(201);
    await request(app).post(`/api/v1/admin/venues/${otherVenue.body.data.id}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows: otherCourtRows } = await pool.query(`select id from courts where venue_id = $1`, [otherVenue.body.data.id]);

    const date = colomboDatePlus(1);
    const otherBooking = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: otherCourtRows[0].id,
        start_at: isoColombo(date, '18:00'),
        end_at: isoColombo(date, '19:00'),
        idempotency_key: `other-booking-${Date.now()}`,
        payment_method: 'cash'
      });
    await request(app)
      .post(`/api/v1/business/bookings/${otherBooking.body.data.booking.id}/mark-paid`)
      .set('Authorization', `Bearer ${otherOwnerToken}`);

    const res = await request(app)
      .get('/api/v1/business/reports?range=7')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    const names = res.body.data.by_venue.map((v) => v.name);
    expect(names).not.toContain('Other Owners Club');
  });

  it('admin reports expose platform tax and venue tax separately', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports?range=7')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    const day = res.body.data.series.find((d) => d.venue_tax > 0);
    expect(day).toBeDefined();
    expect(day.tax).toBeGreaterThan(0);
  });

  it('owner bookings list filters by status, venue, sport and paginates', async () => {
    const res = await request(app)
      .get(`/api/v1/business/bookings?venue_id=${VENUE_ID}&status=confirmed&sport=badminton&page=1&limit=1`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.data[0].venue_name).toBe('Owner Report Venue');
    expect(res.body.data[0].sport).toBe('Badminton');
  });

  it('owner bookings list filters by date range', async () => {
    const res = await request(app)
      .get(`/api/v1/business/bookings?date_from=${colomboDatePlus(0)}&date_to=${colomboDatePlus(1)}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('owner bookings list with no filters returns everything paginated', async () => {
    const res = await request(app)
      .get('/api/v1/business/bookings?limit=50')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  it('the daily digest reports platform and venue tax rows', async () => {
    const html = await buildDigest(colomboDatePlus(-1));
    expect(html).toContain('Platform tax collected');
    expect(html).toContain('Venue tax collected');
  });
});
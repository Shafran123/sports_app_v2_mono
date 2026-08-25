const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let COURT_ID;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

describe('QR check-in', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');

    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        name: 'QR Venue',
        address: '4 Test Ave',
        city: 'Colombo',
        accepts_cash: true,
        sports: ['badminton'],
        courts: [
          { name: 'QR Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    const venueId = submitted.body.data.id;
    await request(app)
      .post(`/api/v1/admin/venues/${venueId}/approve`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [venueId]);
    COURT_ID = rows[0].id;
  });

  async function makeCashBooking(startTime) {
    const endTime = `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}:${startTime.slice(3)}`;
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(colomboDate(2), startTime),
        end_at: isoColombo(colomboDate(2), endTime),
        payment_method: 'cash',
        idempotency_key: `qr-${Date.now()}-${Math.random().toString(36).slice(2)}`
      });
    return res.body.data.booking;
  }

  it('manual (POS) booking mints a QR token', async () => {
    const res = await request(app)
      .post('/api/v1/business/bookings/manual')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        court_id: COURT_ID,
        start_at: isoColombo(colomboDate(3), '09:00'),
        end_at: isoColombo(colomboDate(3), '10:00'),
        player_name: 'Walk-in Guest',
        player_phone: '0701111111',
        amount: 1500
      });

    expect(res.status).toBe(201);
    expect(res.body.data.qr_token).toBeTruthy();
  });

  it('owner checks in a booking by scanning its token', async () => {
    const booking = await makeCashBooking('10:00');

    const res = await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: booking.qr_token });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('checked_in');
    expect(res.body.data.checked_in_at).toBeTruthy();
  });

  it('qr-lookup returns booking details without consuming the token', async () => {
    const booking = await makeCashBooking('14:00');

    const lookup = await request(app)
      .post('/api/v1/business/qr-lookup')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: booking.qr_token });

    expect(lookup.status).toBe(200);
    expect(lookup.body.data.status).toBe('confirmed');

    // token is not consumed by lookup — check-in still works
    const checkin = await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: booking.qr_token });
    expect(checkin.status).toBe(200);
    expect(checkin.body.data.status).toBe('checked_in');
  });

  it('re-scanning a consumed token returns already used', async () => {
    const booking = await makeCashBooking('11:00');
    await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: booking.qr_token });

    const again = await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: booking.qr_token });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('QR_ALREADY_USED');
  });

  it('a non-staff player cannot check in a booking', async () => {
    const booking = await makeCashBooking('12:00');
    const playerToken = await tokenFor('demo-player-uid');

    const res = await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ token: booking.qr_token });

    expect(res.status).toBe(403);
  });

  it('cannot check in after the slot has long ended (window violation)', async () => {
    // booking already finished 2 hours ago
    const pastEnd = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const pastStart = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const { rows } = await pool.query(
      `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, status, payment_method, qr_token)
       values ($1, $2, $3, $4, 1500, 1500, 'confirmed', 'cash', $5)
       returning *`,
      [COURT_ID, (await pool.query(`select id from users where firebase_uid = 'demo-player-uid'`)).rows[0].id,
       pastStart, pastEnd, require('crypto').randomBytes(16).toString('hex')]
    );

    const res = await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: rows[0].qr_token });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECK_IN_WINDOW_VIOLATION');
  });

  it('cannot check in a cancelled booking', async () => {
    const booking = await makeCashBooking('13:00');
    await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);

    const res = await request(app)
      .post('/api/v1/business/qr-checkin')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ token: booking.qr_token });

    expect(res.status).toBe(409);
  });
});
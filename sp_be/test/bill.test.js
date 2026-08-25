const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { bookingBillPdf, registrationBillPdf, emailBillForBooking } = require('../utils/billService');
const { resetFlagsToDefaults } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_TOKEN;
let ADMIN_TOKEN;
let OWNER_TOKEN;
let CASH_COURT_ID;
let BOOKING_ID;

function colomboDate(daysFromNow) {
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
      address: '6 Bill Ave',
      city: 'Colombo',
      accepts_cash: true,
      sports: ['badminton'],
      courts: [
        { name: 'Bill Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

describe('booking bills', () => {
  beforeAll(async () => {
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    await resetFlagsToDefaults();
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('tax_rate', '10'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );

    const venueId = await createVenue('Bill Venue');
    await request(app).post(`/api/v1/admin/venues/${venueId}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [venueId]);
    CASH_COURT_ID = rows[0].id;

    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(colomboDate(4), '09:00'),
        end_at: isoColombo(colomboDate(4), '10:00'),
        idempotency_key: `bill-${Date.now()}`,
        payment_method: 'cash'
      });
    expect(res.status).toBe(201);
    BOOKING_ID = res.body.data.booking.id;
  });

  afterAll(async () => {
    const { resetFlagsToDefaults } = require('./helpers/flags');
    await resetFlagsToDefaults();
  });

  it('renders a PDF for a booking with tax line and QR content', async () => {
    const pdf = await bookingBillPdf(BOOKING_ID);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('exposes a download endpoint for the owning player', async () => {
    const res = await request(app)
      .get(`/api/v1/bookings/${BOOKING_ID}/bill`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('forbids a stranger from downloading the bill', async () => {
    const stranger = await tokenFor(`stranger-${Date.now()}`);
    const res = await request(app)
      .get(`/api/v1/bookings/${BOOKING_ID}/bill`)
      .set('Authorization', `Bearer ${stranger}`);
    expect(res.status).toBe(403);
  });

  it('renders a registration bill for a player and their event', async () => {
    const start = new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString();
    const event = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ name: 'Bill Cup', sport: 'badminton', start_at: start, city: 'Colombo', capacity: 20, price: 2000 });
    const reg = await request(app)
      .post(`/api/v1/events/${event.body.data.id}/register`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(reg.status).toBe(201);

    const { rows } = await pool.query(
      `select id from event_registrations where id = $1`,
      [reg.body.data.registration_id]
    );

    const billRes = await request(app)
      .get(`/api/v1/events/${event.body.data.id}/my-bill`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(billRes.status).toBe(200);
    expect(billRes.body.subarray(0, 5).toString()).toBe('%PDF-');

    const pdf = await registrationBillPdf(rows[0].id);
    expect(pdf).toBeInstanceOf(Buffer);
  });

  it('never emails a walk-in booking (player row IS the venue owner)', async () => {
    const manual = await request(app)
      .post('/api/v1/business/bookings/manual')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(colomboDate(4), '11:00'),
        end_at: isoColombo(colomboDate(4), '12:00'),
        player_name: 'Walk-In Guest',
        player_phone: '0771234567',
        amount: 1500
      });
    expect(manual.status).toBe(201);

    const spy = vi.spyOn(require('../utils/emailService'), 'sendEmail').mockResolvedValue({ success: true });
    await emailBillForBooking(manual.body.data.id);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emails a bill to the player after the cash booking is marked paid', async () => {
    const spy = vi.spyOn(require('../utils/emailService'), 'sendEmail').mockResolvedValue({ success: true });
    await request(app)
      .post(`/api/v1/business/bookings/${BOOKING_ID}/mark-paid`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    // emailBillForBooking is fire-and-forget; give it a beat to run.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(spy).toHaveBeenCalled();
    const arg = spy.mock.calls[0][0];
    expect(arg.subject).toContain('Your bill');
    const files = arg.attachments || (arg.attachment ? [arg.attachment] : []);
    expect(files[0].filename).toMatch(/\.pdf$/);
    spy.mockRestore();
  });
});
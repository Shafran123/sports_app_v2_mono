const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { sendSms } = require('../utils/smsService');
const { resetFlagsToDefaults } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;
let ONLINE_COURT_ID;
let CASH_COURT_ID;
let EVENT_ID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

async function createVenue(name, acceptsCash) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${OWNER_TOKEN}`)
    .send({
      name,
      address: '9 Gate Ave',
      city: 'Colombo',
      accepts_cash: acceptsCash,
      sports: ['badminton'],
      courts: [
        { name: 'Gate Court', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

async function checkout(token, courtId, paymentMethod) {
  const date = colomboDate(3);
  return request(app)
    .post('/api/v1/bookings/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({
      court_id: courtId,
      start_at: isoColombo(date, '10:00'),
      end_at: isoColombo(date, '11:00'),
      idempotency_key: `gate-${Date.now()}-${Math.random()}`,
      payment_method: paymentMethod
    });
}

async function setTax(rate) {
  await pool.query(
    `insert into platform_config (key, value, updated_at) values ('tax_rate', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [JSON.stringify(rate)]
  );
}

describe('feature-flag gates (defaults OFF)', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor(`gate-player-${Date.now()}`);
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');

    const onlineVenue = await createVenue('Gate Online Venue', false);
    const cashVenue = await createVenue('Gate Cash Venue', true);
    await request(app).post(`/api/v1/admin/venues/${onlineVenue}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(app).post(`/api/v1/admin/venues/${cashVenue}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const { rows: onlineRows } = await pool.query(`select id from courts where venue_id = $1`, [onlineVenue]);
    const { rows: cashRows } = await pool.query(`select id from courts where venue_id = $1`, [cashVenue]);
    ONLINE_COURT_ID = onlineRows[0].id;
    CASH_COURT_ID = cashRows[0].id;

    await resetFlagsToDefaults();
  });

  it('lets an unverified player book cash when phone_verification_required is OFF', async () => {
    await resetFlagsToDefaults();
    const res = await checkout(PLAYER_TOKEN, CASH_COURT_ID, 'cash');
    expect(res.status).toBe(201);
    expect(res.body.data.booking.payment_method).toBe('cash');
    expect(res.body.data.booking.total_price).toBe(1000);
  });

  it('rejects online checkout with 409 PAYMENT_UNAVAILABLE when payhere_enabled is OFF', async () => {
    await resetFlagsToDefaults();
    const res = await checkout(PLAYER_TOKEN, ONLINE_COURT_ID, 'online');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_UNAVAILABLE');
  });

  it('creates a hold when payhere_enabled is ON even for an unverified player', async () => {
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('payhere_enabled', 'true'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );
    const res = await checkout(PLAYER_TOKEN, ONLINE_COURT_ID, 'online');
    expect(res.status).toBe(201);
    expect(res.body.data.hold_id).toBeDefined();
    await pool.query(`delete from holds where idempotency_key = $1`, [res.body.data.idempotency_key]);
    await resetFlagsToDefaults();
  });

  it('silently skips SMS sends when sms_enabled is OFF', async () => {
    await resetFlagsToDefaults();
    const hadKey = process.env.SMSGO_API_KEY;
    delete process.env.SMSGO_API_KEY;

    const off = await sendSms({ to: '+94771234567', message: 'hi' });
    expect(off).toEqual({ success: false, error: 'SMS disabled' });

    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('sms_enabled', 'true'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );
    const enabled = await sendSms({ to: '+94771234567', message: 'hi' });
    expect(enabled.error).toBe('SMS not configured');

    if (hadKey) process.env.SMSGO_API_KEY = hadKey;
    await resetFlagsToDefaults();
  });
});

describe('event discovery state', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor(`discovery-player-${Date.now()}`);
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    await resetFlagsToDefaults();

    const start = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    const created = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ name: 'Discovery Cup', sport: 'badminton', start_at: start, city: 'Colombo', capacity: 10, price: 500 });
    EVENT_ID = created.body.data.id;
  });

  it('lists events publicly in coming_soon but blocks registration', async () => {
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('events_discovery_state', '"coming_soon"'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );
    const list = await request(app).get('/api/v1/events');
    expect(list.status).toBe(200);
    expect(list.body.data.map((e) => e.id)).toContain(EVENT_ID);

    const detail = await request(app).get(`/api/v1/events/${EVENT_ID}`);
    expect(detail.status).toBe(200);

    const reg = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/register`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(reg.status).toBe(409);
    expect(reg.body.error.code).toBe('EVENTS_NOT_AVAILABLE');
    await resetFlagsToDefaults();
  });

  it('removes events entirely when hidden', async () => {
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('events_discovery_state', '"hidden"'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );
    const list = await request(app).get('/api/v1/events');
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(0);

    const detail = await request(app).get(`/api/v1/events/${EVENT_ID}`);
    expect(detail.status).toBe(404);
    await resetFlagsToDefaults();
  });

  it('lets players register once enabled again', async () => {
    const reg = await request(app)
      .post(`/api/v1/events/${EVENT_ID}/register`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(reg.status).toBe(201);
  });
});

describe('tax snapshots', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor(`tax-player-${Date.now()}`);
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');

    const venue = await createVenue('Tax Cash Venue', true);
    await request(app).post(`/api/v1/admin/venues/${venue}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [venue]);
    CASH_COURT_ID = rows[0].id;
    await setTax(12);
  });

  afterAll(async () => {
    await setTax(0);
  });

  it('carves half-up tax out of the listed price and snapshots the rate on cash bookings', async () => {
    const res = await checkout(PLAYER_TOKEN, CASH_COURT_ID, 'cash');
    expect(res.status).toBe(201);
    const booking = res.body.data.booking;
    expect(booking.total_price).toBe(1000); // listed price IS the total
    expect(booking.tax_rate).toBe(12);
    expect(booking.tax_amount).toBe(120);

    const { rows } = await pool.query(
      `select total_price, tax_rate, tax_amount, price_per_slot from bookings where id = $1`,
      [booking.id]
    );
    expect(rows[0].total_price).toBe(1000);
    expect(rows[0].price_per_slot).toBe(1000);
  });

  it('serves events with inclusive totals at registration', async () => {
    const { rows: eventRows } = await pool.query(
      `select * from events where id = 'bbbbbbbb-0000-0000-0000-000000000002'::uuid`
    );
    const event = eventRows[0];

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(2500); // listed price IS the total
    expect(res.body.data.payment_params.amount).toBe('2500');

    const { rows: regRows } = await pool.query(
      `select tax_rate, tax_amount from event_registrations where id = $1`,
      [res.body.data.registration_id]
    );
    expect(regRows[0].tax_rate).toBe(12);
    expect(regRows[0].tax_amount).toBe(300);
  });
});
// Site Customer auth (ADR-0030, ticket 01): per-Business accounts with our
// own auth — register/login sessions, cross-Business independence, OTP
// verification scoped to the Business, and Google mapping. Firebase is never
// involved; every action resolves the live-site Business from the hostname.

const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const siteCustomers = require('../services/siteCustomers');
const { enableSms } = require('./helpers/flags');

let BUSINESS_A;
let BUSINESS_B;
let posted;

const rand = Math.random().toString(36).slice(2, 10);

const colomboDate = (daysFromNow) => {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function bodyText(opts) {
  const body = opts?.body ?? opts?.formData;
  if (typeof body === 'string') return body;
  if (body && typeof body.entries === 'function') {
    return [...body.entries()].map(([k, v]) => `${k}=${v}`).join('\n');
  }
  return '';
}

function codeFromSms(phone) {
  const call = posted.mock.calls.findLast(([url, opts]) => {
    const text = bodyText(opts);
    return text.includes(phone) && text.includes('verification code is');
  });
  const match = bodyText(call?.[1]).match(/verification code is (\d{6})/);
  return match ? match[1] : null;
}

function codeFromEmail(email) {
  const call = posted.mock.calls.findLast(([url, opts]) => bodyText(opts).includes(email || ''));
  const match = bodyText(call?.[1]).match(/verification code is (\d{6})/);
  return match ? match[1] : null;
}

function htmlParamFromEmail(email) {
  const call = posted.mock.calls.findLast(([url, opts]) => bodyText(opts).includes(email || ''));
  const body = call?.[1]?.body;
  if (!body || typeof body.entries !== 'function') return null;
  for (const [k, v] of body.entries()) {
    if (k === 'html') return String(v);
  }
  return null;
}

describe('site customer auth (ADR-0030, ticket 01)', () => {
  beforeAll(async () => {
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    await enableSms();
    posted = vi.fn(async (_url, opts) => ({ ok: true, status: 200, text: async () => '', json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', posted);

    const [ownerA, ownerB] = await Promise.all([
      pool.query(
        `insert into users (firebase_uid, email, name, role, status, onboarding_state)
         values ($1, $2, 'Auth Owner A', 'venue_owner', 'active', 'accepted')
         on conflict (firebase_uid) do update set role = 'venue_owner', onboarding_state = 'accepted'
         returning id`,
        [`siteauth-owner-a-${rand}`, `owner-a-${rand}@myslot.test`]
      ),
      pool.query(
        `insert into users (firebase_uid, email, name, role, status, onboarding_state)
         values ($1, $2, 'Auth Owner B', 'venue_owner', 'active', 'accepted')
         on conflict (firebase_uid) do update set role = 'venue_owner', onboarding_state = 'accepted'
         returning id`,
        [`siteauth-owner-b-${rand}`, `owner-b-${rand}@myslot.test`]
      )
    ]);
    const [bA, bB] = await Promise.all([
      pool.query(`insert into businesses (owner_id, name) values ($1, 'Site Auth A') returning *`, [ownerA.rows[0].id]).then((r) => r.rows[0]),
      pool.query(`insert into businesses (owner_id, name) values ($1, 'Site Auth B') returning *`, [ownerB.rows[0].id]).then((r) => r.rows[0])
    ]);
    BUSINESS_A = bA;
    BUSINESS_B = bB;
    await pool.query(
      `insert into site_domain_requests (business_id, hostname, hostname_kind, status, dns_type, dns_name, dns_value)
       values ($1, 'site-customer.test', 'custom', 'live', 'TXT', 'site-customer.test', 'token=abc'),
              ($2, 'site-customer-b.test', 'custom', 'live', 'TXT', 'site-customer-b.test', 'token=abc')`,
      [BUSINESS_A.id, BUSINESS_B.id]
    );
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status)
       values ('siteauth-admin', 'auth-admin@myslot.test', 'Auth Admin', 'admin', 'active')
       on conflict (firebase_uid) do update set role = 'admin'`
    );
    await pool.query(`delete from site_customers where business_id in ($1, $2)`, [BUSINESS_A.id, BUSINESS_B.id]);
  });

  const registerAt = (host, email, password = 'correct-horse-9') =>
    request(app).post('/api/v1/site-auth/register').send({ site_hostname: host, email, name: 'Site Pam', password });

  it('unit: scrypt password hashes round-trip and reject wrong passwords', () => {
    const hash = siteCustomers.hashPassword('hunter2-hunter2');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(siteCustomers.verifyPassword('hunter2-hunter2', hash)).toBe(true);
    expect(siteCustomers.verifyPassword('nope-nope', hash)).toBe(false);
    expect(siteCustomers.verifyPassword('x', 'garbage')).toBe(false);
  });

  it('registers a customer, issues a session, and rejects a duplicate email at the same site', async () => {
    const email = `pam-${rand}@abc.test`;
    const res = await registerAt('site-customer.test', email);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.data.customer.email).toBe(email);
    expect(res.body.data.customer.password_hash).toBeUndefined();

    const dup = await registerAt('site-customer.test', email.toUpperCase());
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SITE_CUSTOMER_EXISTS');
  });

  it('keeps accounts fully independent across businesses (same email, own verification)', async () => {
    const email = `pam2-${rand}@abc.test`;
    const a = await registerAt('site-customer.test', email);
    const b = await registerAt('site-customer-b.test', email);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.customer.id).not.toBe(b.body.data.customer.id);
    expect(a.body.data.customer.business_id).not.toBe(b.body.data.customer.business_id);
  });

  it('requires a live site hostname and rejects bad credentials', async () => {
    const dead = await registerAt('not-live.test', `ghost-${rand}@abc.test`);
    expect(dead.status).toBe(403);
    expect(dead.body.error.code).toBe('SITE_HOST_NOT_LIVE');

    const email = `login-${rand}@abc.test`;
    await registerAt('site-customer.test', email, 'password-1');
    const wrong = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-customer.test', email, password: 'wrong-pass' });
    expect(wrong.status).toBe(401);
    const right = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-customer.test', email, password: 'password-1' });
    expect(right.status).toBe(200);
    expect(right.body.data.token).toBeTruthy();
  });

  it('resolves me with the session and revokes it on logout', async () => {
    const email = `me-${rand}@abc.test`;
    const reg = await registerAt('site-customer.test', email);
    const token = reg.body.data.token;
    const me = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const out = await request(app).post('/api/v1/site-auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);
    const after = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('verifies the phone via a business-scoped OTP and marks it verified', async () => {
    const email = `phone-${rand}@abc.test`;
    const reg = await registerAt('site-customer.test', email);
    const token = reg.body.data.token;

    const send = await request(app).post('/api/v1/site-auth/verify-phone/send').set('Authorization', `Bearer ${token}`).send({ phone: '+94 77 555 1234' });
    expect(send.status).toBe(200);
    const code = codeFromSms('94775551234');
    expect(code).toMatch(/^\d{6}$/);

    const bad = await request(app).post('/api/v1/site-auth/verify-phone/confirm').set('Authorization', `Bearer ${token}`).send({ phone: '+94 77 555 1234', code: '000000' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('OTP_INVALID');

    const good = await request(app).post('/api/v1/site-auth/verify-phone/confirm').set('Authorization', `Bearer ${token}`).send({ phone: '+94 77 555 1234', code });
    expect(good.status).toBe(200);
    const { rows } = await pool.query(`select phone_verified_at from site_customers where id = $1`, [reg.body.data.customer.id]);
    expect(rows[0].phone_verified_at).toBeTruthy();
  });

  it('verifies the email via OTP and marks it verified', async () => {
    const email = `email-${rand}@abc.test`;
    const reg = await registerAt('site-customer.test', email);
    const token = reg.body.data.token;

    const send = await request(app).post('/api/v1/site-auth/verify-email/send').set('Authorization', `Bearer ${token}`).send({ email });
    expect(send.status).toBe(200);
    const code = codeFromEmail(email);
    expect(code).toMatch(/^\d{6}$/);
    // The site-auth email must carry a real HTML body (built from the same
    // template as the platform OTP email), not a literal "undefined".
    const html = htmlParamFromEmail(email);
    expect(html).toBeTruthy();
    expect(html).not.toBe('undefined');
    expect(html).toContain(code);

    const good = await request(app).post('/api/v1/site-auth/verify-email/confirm').set('Authorization', `Bearer ${token}`).send({ email, code });
    expect(good.status).toBe(200);
    const { rows } = await pool.query(`select email_verified_at from site_customers where id = $1`, [reg.body.data.customer.id]);
    expect(rows[0].email_verified_at).toBeTruthy();
  });

  it('maps Google sign-in to one per-business profile per google_sub', async () => {
    const payload = { site_hostname: 'site-customer.test', email: `g-${rand}@gmail.test`, name: 'Google Pam', google_sub: `sub-${rand}` };
    const first = await request(app).post('/api/v1/site-auth/google').send(payload);
    expect(first.status).toBe(201);
    expect(first.body.data.customer.email_verified_at).toBeTruthy();

    const second = await request(app).post('/api/v1/site-auth/google').send({ ...payload, name: 'Google Pam II' });
    expect(second.status).toBe(201);
    expect(second.body.data.customer.id).toBe(first.body.data.customer.id);
  });

  it('books on its site as a Site Customer (cash-only, stores site_customer_id)', async () => {
    // A venue on Business A's live site, with one court.
    await pool.query(`delete from site_customers where business_id = $1`, [BUSINESS_A.id]);
    const ownerRow = await pool.query(`select id from users where firebase_uid = 'siteauth-owner-a-${rand}'`);
    const venue = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${await tokenFor(`siteauth-owner-a-${rand}`)}`)
      .send({
        name: 'Site Auth Court House',
        address: '1 Auth Rd',
        city: 'Colombo',
        accepts_cash: true,
        sports: ['badminton'],
        courts: [{ name: 'Auth Court', sport: 'badminton', price_per_slot: 900, slot_duration_min: 60, capacity: 4, is_indoor: true }],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    expect(venue.status).toBe(201);
    await request(app).post(`/api/v1/admin/venues/${venue.body.data.id}/approve`).set('Authorization', `Bearer ${await tokenFor('siteauth-admin')}`);
    const { rows: courtRows } = await pool.query(`select id from courts where venue_id = $1`, [venue.body.data.id]);

    const reg = await registerAt('site-customer.test', `booker-${rand}@abc.test`);
    expect(reg.status).toBe(201);
    const token = reg.body.data.token;

    // Per-Business verified gates: a Site Customer must hold a Verified Phone
    // and Verified Email at THIS Business before booking (ADR-0030).
    await request(app).post('/api/v1/site-auth/verify-phone/send').set('Authorization', `Bearer ${token}`).send({ phone: '+94 77 777 0001' });
    const phoneCode = codeFromSms('94777770001');
    await request(app).post('/api/v1/site-auth/verify-phone/confirm').set('Authorization', `Bearer ${token}`).send({ phone: '+94 77 777 0001', code: phoneCode });
    await request(app).post('/api/v1/site-auth/verify-email/send').set('Authorization', `Bearer ${token}`).send({ email: `booker-${rand}@abc.test` });
    const emailCode = codeFromEmail(`booker-${rand}@abc.test`);
    await request(app).post('/api/v1/site-auth/verify-email/confirm').set('Authorization', `Bearer ${token}`).send({ email: `booker-${rand}@abc.test`, code: emailCode });

    const online = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        court_id: courtRows[0].id,
        start_at: `${colomboDate(2)}T18:00:00+05:30`,
        end_at: `${colomboDate(2)}T19:00:00+05:30`,
        payment_method: 'online',
        site_hostname: 'site-customer.test',
        idempotency_key: `sc-online-${Date.now()}`
      });
    expect(online.status).toBe(409);
    expect(online.body.error.code).toBe('PAYMENT_UNAVAILABLE');

    // The Site Customer must receive the booking-confirmation EMAIL (not just
    // SMS) — the checkout dispatch resolves the recipient from the booking's
    // user_email, which for a site booking must come from the customer row.
    const sendEmailSpy = vi.spyOn(require('../utils/emailService'), 'sendEmail').mockResolvedValue({ success: false, error: 'Email not configured' });
    const cash = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        court_id: courtRows[0].id,
        start_at: `${colomboDate(2)}T18:00:00+05:30`,
        end_at: `${colomboDate(2)}T19:00:00+05:30`,
        payment_method: 'cash',
        site_hostname: 'site-customer.test',
        idempotency_key: `sc-cash-${Date.now()}`
      });
    expect(cash.status).toBe(201);
    expect(cash.body.data.booking.site_customer_id).toBe(reg.body.data.customer.id);
    expect(cash.body.data.booking.user_id).toBeNull();

    const confirmationEmails = sendEmailSpy.mock.calls
      .map(([arg]) => arg)
      .filter((arg) => arg.to === `booker-${rand}@abc.test` && (arg.html || '').includes('Your slot is booked'));
    expect(confirmationEmails.length).toBe(1);
    sendEmailSpy.mockRestore();

    // The Site Customer must be able to see their own booking after sign-in:
    // the booking-detail API (with the QR token) and their bookings list.
    const detail = await request(app)
      .get(`/api/v1/bookings/${cash.body.data.booking.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(cash.body.data.booking.id);
    expect(detail.body.data.qr_token).toBeTruthy();

    const list = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((b) => b.id === cash.body.data.booking.id)).toBe(true);

    // The Site Customer may cancel their own booking (same ownership model).
    const cancel = await request(app)
      .post(`/api/v1/bookings/${cash.body.data.booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('cancelled');

    // The owner console sees the Site Customer's name on the booking (the
    // business bookings query coalesces the site_customer_id to the customer).
    const ownerBookings = await request(app)
      .get('/api/v1/business/bookings')
      .set('Authorization', `Bearer ${await tokenFor(`siteauth-owner-a-${rand}`)}`);
    expect(ownerBookings.status).toBe(200);
    const ownerBookingRow = ownerBookings.body.data.find((b) => b.id === cash.body.data.booking.id);
    expect(ownerBookingRow).toBeTruthy();
    expect(ownerBookingRow.player_name).toBe('Site Pam');
    expect(ownerBookingRow.player_phone).toBe('+94777770001');

    const noHost = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        court_id: courtRows[0].id,
        start_at: `${colomboDate(2)}T20:00:00+05:30`,
        end_at: `${colomboDate(2)}T21:00:00+05:30`,
        payment_method: 'cash',
        idempotency_key: `sc-nohost-${Date.now()}`
      });
    expect(noHost.status).toBe(403);
    expect(noHost.body.error.code).toBe('SITE_HOST_REQUIRED');
  });

  it('serves the Business customers directory with booking aggregates (ADR-0030, ticket 05)', async () => {
    const ownerToken = await tokenFor(`siteauth-owner-a-${rand}`);
    const res = await request(app)
      .get('/api/v1/business/customers')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find((c) => c.email === `booker-${rand}@abc.test`);
    expect(row).toBeTruthy();
    expect(row.business_id).toBeTruthy();
    expect(row.booking_count).toBeGreaterThanOrEqual(1);
    expect(row.total_spend).toBeGreaterThan(0);
    expect(row.name).toBe('Site Pam');

    // Search narrows.
    const searched = await request(app)
      .get('/api/v1/business/customers?q=booker')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(searched.status).toBe(200);
    expect(searched.body.data.every((c) => c.email.includes('booker'))).toBe(true);

    // A player (not the owner) is rejected by the business route guard.
    const player = await request(app).get('/api/v1/business/customers').set('Authorization', `Bearer ${await tokenFor('siteauth-player-' + rand)}`);
    expect(player.status).toBe(403);
  });
});

async function tokenFor(uid) {
  const { SignJWT } = require('jose');
  return new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret'));
}
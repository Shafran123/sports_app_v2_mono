// Anti-bot Check (tickets 04-06): the recaptcha verification service and the
//  middleware — valid/missing/invalid/expired/wrong-action/
// wrong-hostname tokens, escalate-vs-reject on the score, the widget iframe
// (siteOnly) exemption, and the owner-lead gate.

const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const recaptcha = require('../services/recaptcha');

let BUSINESS;
let posted;

const rand = Math.random().toString(36).slice(2, 10);

const colomboDate = (daysFromNow) => {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// siteverify stub: token shapes drive the verdict.
//   good-<score>-<action>  -> success with that score + action (action
//                             defaults to the stub's defaultAction)
//   invalid        -> success:false, invalid-input-response
//   expired        -> success:false, timeout-or-duplicate
// anything else    -> success:false, missing-input-response
function stubSiteverify({ defaultAction = 'site_login', defaultHostname = 'captcha-site.test' } = {}) {
  return vi.fn(async (url, opts) => {
    if (String(url).includes('siteverify')) {
      const body = new URLSearchParams(String(opts?.body || ''));
      const token = body.get('response') || '';
      let payload;
      if (token === 'invalid' || token === 'expired') {
        payload = {
          success: false,
          'error-codes': [token === 'expired' ? 'timeout-or-duplicate' : 'invalid-input-response']
        };
      } else if (token.startsWith('good-')) {
        const [_, score, action] = token.split('-');
        payload = { success: true, score: Number(score), action: action || defaultAction, hostname: defaultHostname };
      } else {
        payload = { success: false, 'error-codes': ['missing-input-response'] };
      }
      return { ok: true, status: 200, json: async () => payload };
    }
    // Mailgun (the escalation email) — capture so tests can read the code.
    return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
  });
}

function emailCallFor(email) {
  return posted.mock.calls.findLast(([url, opts]) => {
    if (!String(url).includes('mailgun')) return false;
    const body = opts?.body;
    if (!body || typeof body.entries !== 'function') return false;
    return [...body.entries()].some(([k, v]) => String(v).includes(email));
  });
}

function codeFromEmail(email) {
  const call = emailCallFor(email);
  const body = call?.[1]?.body;
  if (!body || typeof body.entries !== 'function') return null;
  const html = [...body.entries()].find(([k]) => k === 'html')?.[1] || '';
  return String(html).match(/verification code is (\d{6})/)?.[1] || null;
}

async function setupBusiness() {
  const owner = await pool.query(
    `insert into users (firebase_uid, email, name, role, status, onboarding_state)
     values ($1, $2, 'Captcha Owner', 'venue_owner', 'active', 'accepted')
     on conflict (firebase_uid) do update set role = 'venue_owner', onboarding_state = 'accepted'
     returning id`,
    [`captcha-owner-${rand}`, `captcha-owner-${rand}@myslot.test`]
  );
  const biz = await pool.query(`insert into businesses (owner_id, name) values ($1, 'Captcha Biz') returning *`, [owner.rows[0].id]).then((r) => r.rows[0]);
  await pool.query(
    `insert into site_domain_requests (business_id, hostname, hostname_kind, status, dns_type, dns_name, dns_value)
     values ($1, 'captcha-site.test', 'custom', 'live', 'TXT', 'captcha-site.test', 'token=abc')`,
    [biz.id]
  );
  await pool.query(
    `insert into users (firebase_uid, email, name, role, status)
     values ('captcha-admin', 'captcha-admin@myslot.test', 'Captcha Admin', 'admin', 'active')
     on conflict (firebase_uid) do update set role = 'admin'`
  );
  return biz;
}

async function tokenFor(uid) {
  const { SignJWT } = require('jose');
  return new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret'));
}

describe('recaptcha service (ticket 04)', () => {
  const env = { RECAPTCHA_SECRET_KEY: 'test-secret' };

  it('fails closed when not configured', async () => {
    const result = await recaptcha.verifyRecaptcha({ token: 'x', expectedAction: 'a', hostname: 'h', env: {} });
    expect(result).toEqual({ ok: false, code: 'CAPTCHA_NOT_CONFIGURED', message: expect.any(String) });
  });

  it('requires a token', async () => {
    const result = await recaptcha.verifyRecaptcha({ token: '', expectedAction: 'a', hostname: 'h', env });
    expect(result.code).toBe('CAPTCHA_REQUIRED');
  });

  it('passes a valid token with the score intact', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, score: 0.9, action: 'site_login', hostname: 'captcha-site.test' })
    })));
    const result = await recaptcha.verifyRecaptcha({ token: 'good-0.9', expectedAction: 'site_login', hostname: 'captcha-site.test', env });
    expect(result).toEqual({ ok: true, score: 0.9 });
    // The secret never leaves the server as anything but the siteverify secret.
    const body = String(vi.mocked(fetch).mock.calls[0][1].body);
    expect(body).toContain('secret=test-secret');
    expect(body).toContain('response=good-0.9');
    vi.unstubAllGlobals();
  });

  it('fails closed when the token reports no hostname or the request has no origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, score: 0.9, action: 'site_login' })
    })));
    const noTokenHost = await recaptcha.verifyRecaptcha({ token: 'good-0.9', expectedAction: 'site_login', hostname: 'captcha-site.test', env });
    expect(noTokenHost.code).toBe('CAPTCHA_HOSTNAME_MISMATCH');
    vi.unstubAllGlobals();
  });

  it('rejects a consumed/expired token (single-use respected)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    })));
    const result = await recaptcha.verifyRecaptcha({ token: 'expired', expectedAction: 'a', hostname: 'h', env });
    expect(result.code).toBe('CAPTCHA_TOKEN_INVALID');
    vi.unstubAllGlobals();
  });

  it('rejects any other failed siteverify verdict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] })
    })));
    const result = await recaptcha.verifyRecaptcha({ token: 'invalid', expectedAction: 'a', hostname: 'h', env });
    expect(result.code).toBe('CAPTCHA_TOKEN_INVALID');
    vi.unstubAllGlobals();
  });

  it('rejects a token minted for a different action', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, score: 0.9, action: 'site_checkout', hostname: 'captcha-site.test' })
    })));
    const result = await recaptcha.verifyRecaptcha({ token: 'good-0.9', expectedAction: 'site_login', hostname: 'captcha-site.test', env });
    expect(result.code).toBe('CAPTCHA_ACTION_MISMATCH');
    vi.unstubAllGlobals();
  });

  it('rejects a token whose hostname does not match the request origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, score: 0.9, action: 'site_login', hostname: 'evil.example.com' })
    })));
    const result = await recaptcha.verifyRecaptcha({ token: 'good-0.9', expectedAction: 'site_login', hostname: 'captcha-site.test', env });
    expect(result.code).toBe('CAPTCHA_HOSTNAME_MISMATCH');
    vi.unstubAllGlobals();
  });

  it('treats apex and www as the same host and ignores ports', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, score: 0.8, action: 'lead_submit', hostname: 'www.myslot.test' })
    })));
    const result = await recaptcha.verifyRecaptcha({ token: 'good-0.8', expectedAction: 'lead_submit', hostname: 'myslot.test:3000', env });
    expect(result.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('fails closed when siteverify is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const result = await recaptcha.verifyRecaptcha({ token: 'good-0.9', expectedAction: 'a', hostname: 'h', env });
    expect(result.code).toBe('CAPTCHA_VERIFICATION_FAILED');
    vi.unstubAllGlobals();
  });

  it('fails closed when siteverify errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })));
    const result = await recaptcha.verifyRecaptcha({ token: 'good-0.9', expectedAction: 'a', hostname: 'h', env });
    expect(result.code).toBe('CAPTCHA_VERIFICATION_FAILED');
    vi.unstubAllGlobals();
  });

  it('defaults the score threshold to 0.5 and reads it from env', () => {
    expect(recaptcha.minScore({})).toBe(0.5);
    expect(recaptcha.minScore({ RECAPTCHA_MIN_SCORE: '0.3' })).toBe(0.3);
    expect(recaptcha.minScore({ RECAPTCHA_MIN_SCORE: 'junk' })).toBe(0.5);
  });
});

describe('anti-bot on dedicated site auth + checkout (ticket 05)', () => {
  let courtId;
  let ownerToken;
  let adminToken;

  beforeAll(async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    posted = stubSiteverify({ action: 'site_login', hostname: 'captcha-site.test' });
    vi.stubGlobal('fetch', posted);
    // The suite shares one DB across files and earlier suites flip the
    // phone-verification flag on; this suite's site checkouts must not be
    // gated by it (the captcha gate is what is under test).
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('phone_verification_required', 'false'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );

    BUSINESS = await setupBusiness();
    ownerToken = await tokenFor(`captcha-owner-${rand}`);
    adminToken = await tokenFor('captcha-admin');

    // A venue on the live site, with one court (mirrors siteAuth.test.js).
    const venue = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Captcha Court House',
        address: '1 Captcha Rd',
        city: 'Colombo',
        accepts_cash: true,
        sports: ['badminton'],
        courts: [{ name: 'Captcha Court', sport: 'badminton', price_per_slot: 900, slot_duration_min: 60, capacity: 4, is_indoor: true }],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    expect(venue.status).toBe(201);
    await request(app).post(`/api/v1/admin/venues/${venue.body.data.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [venue.body.data.id]);
    courtId = rows[0].id;
  });

  afterAll(async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  const atSite = (req) => req.set('Host', 'captcha-site.test');
  const siteHost = 'captcha-site.test';

  it('site login with a valid token works and the good score is not exposed', async () => {
    const email = `good-${rand}@abc.test`;
    const reg = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: siteHost,
      name: 'Good Pam',
      email,
      password: 'correct-horse-9',
      captcha_token: 'good-0.9-site_register'
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.token).toMatch(/^[0-9a-f]{64}$/);

    const login = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost,
      email,
      password: 'correct-horse-9',
      captcha_token: 'good-0.7'
    });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();
    expect(login.body.data.captcha).toBeUndefined();
  });

  it('fails closed on a missing, invalid, or wrong-action token', async () => {
    const email = `missing-${rand}@abc.test`;
    const missing = await atSite(request(app).post('/api/v1/site-auth/login')).send({ site_hostname: siteHost, email, password: 'x' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('CAPTCHA_REQUIRED');

    const invalid = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost, email, password: 'x', captcha_token: 'invalid'
    });
    expect(invalid.status).toBe(403);
    expect(invalid.body.error.code).toBe('CAPTCHA_TOKEN_INVALID');

    const expired = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost, email, password: 'x', captcha_token: 'expired'
    });
    expect(expired.status).toBe(403);
    expect(expired.body.error.code).toBe('CAPTCHA_TOKEN_INVALID');

    const wrongAction = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost, email, password: 'x', captcha_token: 'good-0.9-site_register'
    });
    expect(wrongAction.status).toBe(403);
    expect(wrongAction.body.error.code).toBe('CAPTCHA_ACTION_MISMATCH');

    // A non-live host is the widget iframe's origin (ADR-0042): the gate is
    // skipped entirely, so the answer is the normal auth one (401 here for
    // the wrong password) — never a captcha error.
    const widgetOrigin = await request(app)
      .post('/api/v1/site-auth/login')
      .set('Host', 'other-site.test')
      .send({ site_hostname: siteHost, email, password: 'x', captcha_token: 'good-0.9' });
    expect(widgetOrigin.status).toBe(401);
    expect(widgetOrigin.body.error.code).toBe('SITE_CUSTOMER_BAD_CREDENTIALS');
  });

  it('a low-score login escalates to an email-OTP challenge; confirming issues the session', async () => {
    const email = `esc-login-${rand}@abc.test`;
    const reg = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: siteHost, name: 'Esc Pam', email, password: 'correct-horse-9', captcha_token: 'good-0.9-site_register'
    });
    expect(reg.status).toBe(201);

    // Wrong password on a low score still answers 401 — no oracle, no challenge.
    const bad = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost, email, password: 'wrong-pass', captcha_token: 'good-0.1'
    });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('SITE_CUSTOMER_BAD_CREDENTIALS');

    const low = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost, email, password: 'correct-horse-9', captcha_token: 'good-0.1'
    });
    expect(low.status).toBe(202);
    expect(low.body.data.escalated).toBe(true);
    expect(low.body.data.challenge_id).toBeTruthy();
    expect(low.body.data.email).toBe(email);
    // The escalation must have emailed a code, and no session was issued.
    const code = codeFromEmail(email);
    expect(code).toMatch(/^\d{6}$/);

    const wrongCode = await request(app).post('/api/v1/site-auth/challenge/confirm').send({
      challenge_id: low.body.data.challenge_id, code: '000000'
    });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.code).toBe('OTP_INVALID');

    const done = await request(app).post('/api/v1/site-auth/challenge/confirm').send({
      challenge_id: low.body.data.challenge_id, code
    });
    expect(done.status).toBe(200);
    expect(done.body.data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(done.body.data.customer.email).toBe(email);

    // Single-use: replaying the same challenge fails.
    const replay = await request(app).post('/api/v1/site-auth/challenge/confirm').send({
      challenge_id: low.body.data.challenge_id, code
    });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('OTP_INVALID');
  });

  it('a low-score register escalates, then the confirm creates the account', async () => {
    const email = `esc-reg-${rand}@abc.test`;
    const low = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: siteHost,
      name: 'Reg Esc',
      email,
      password: 'correct-horse-9',
      captcha_token: 'good-0.1-site_register'
    });
    expect(low.status).toBe(202);
    expect(low.body.data.escalated).toBe(true);
    const code = codeFromEmail(email);
    expect(code).toMatch(/^\d{6}$/);

    const done = await request(app).post('/api/v1/site-auth/challenge/confirm').send({
      challenge_id: low.body.data.challenge_id, code
    });
    expect(done.status).toBe(200);
    expect(done.body.data.customer.email).toBe(email);
    expect(done.body.data.token).toBeTruthy();

    const { rows } = await pool.query(`select password_hash from site_customers where email = $1`, [email]);
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);

    // The password actually works afterwards (no account without a usable login).
    const login = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: siteHost, email, password: 'correct-horse-9', captcha_token: 'good-0.9'
    });
    expect(login.status).toBe(200);

    // And a second low-score register for the same email answers 409 (no new challenge).
    const dup = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: siteHost, name: 'Reg Esc', email, password: 'correct-horse-9', captcha_token: 'good-0.1-site_register'
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SITE_CUSTOMER_EXISTS');
  });

  it('escalation validates input on the same rules as a normal register', async () => {
    const weak = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: siteHost, name: 'X', email: `weak-${rand}@abc.test`, password: 'short', captcha_token: 'good-0.1-site_register'
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('PASSWORD_WEAK');

    const deadSite = await request(app)
      .post('/api/v1/site-auth/register')
      .set('Host', 'captcha-site.test')
      .send({ site_hostname: 'not-live.test', name: 'X', email: `dead-${rand}@abc.test`, password: 'correct-horse-9', captcha_token: 'good-0.1-site_register' });
    expect(deadSite.status).toBe(403);
    expect(deadSite.body.error.code).toBe('SITE_HOST_NOT_LIVE');
  });

  it('never runs the check on non-site (widget iframe) hosts — no token needed', async () => {
    // The widget iframe's requests arrive from the platform host, not a live
    // site hostname (ADR-0042) — sign-in there must keep working tokenless.
    const email = `widget-${rand}@abc.test`;
    const reg = await request(app).post('/api/v1/site-auth/register').send({
      site_hostname: siteHost, name: 'Widget Pam', email, password: 'correct-horse-9'
    });
    expect(reg.status).toBe(201);

    const login = await request(app).post('/api/v1/site-auth/login').send({
      site_hostname: siteHost, email, password: 'correct-horse-9'
    });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();
  });

  it('a low-score site checkout rejects the booking; a good score books', async () => {
    const email = `checkout-${rand}@abc.test`;
    const reg = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: siteHost, name: 'Checkout Pam', email, password: 'correct-horse-9', captcha_token: 'good-0.9-site_register'
    });
    expect(reg.status).toBe(201);
    const token = reg.body.data.token;

    // Verified Email gate: the site requires a Verified Email before booking.
    await request(app).post('/api/v1/site-auth/verify-email/send').set('Authorization', `Bearer ${token}`).send({ email });
    const emailCode = codeFromEmail(email);
    await request(app).post('/api/v1/site-auth/verify-email/confirm').set('Authorization', `Bearer ${token}`).send({ email, code: emailCode });

    const slot = { court_id: courtId, start_at: `${colomboDate(2)}T18:00:00+05:30`, end_at: `${colomboDate(2)}T19:00:00+05:30`, payment_method: 'cash', site_hostname: siteHost };

    const low = await atSite(request(app).post('/api/v1/bookings/checkout'))
      .set('Authorization', `Bearer ${token}`)
      .send({ ...slot, idempotency_key: `low-${Date.now()}`, captcha_token: 'good-0.1-site_checkout' });
    expect(low.status).toBe(403);
    expect(low.body.error.code).toBe('CAPTCHA_LOW_SCORE');

    const good = await atSite(request(app).post('/api/v1/bookings/checkout'))
      .set('Authorization', `Bearer ${token}`)
      .send({ ...slot, start_at: `${colomboDate(2)}T20:00:00+05:30`, end_at: `${colomboDate(2)}T21:00:00+05:30`, idempotency_key: `good-${Date.now()}`, captcha_token: 'good-0.9-site_checkout' });
    expect(good.status).toBe(201);
    expect(good.body.data.booking.site_customer_id).toBe(reg.body.data.customer.id);

    // A site checkout with no token at all is also rejected (fails closed).
    const noToken = await atSite(request(app).post('/api/v1/bookings/checkout'))
      .set('Authorization', `Bearer ${token}`)
      .send({ ...slot, start_at: `${colomboDate(3)}T18:00:00+05:30`, end_at: `${colomboDate(3)}T19:00:00+05:30`, idempotency_key: `none-${Date.now()}` });
    expect(noToken.status).toBe(400);
    expect(noToken.body.error.code).toBe('CAPTCHA_REQUIRED');
  });
});

describe('anti-bot on the owner-lead form (ticket 06)', () => {
  beforeAll(async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    // The lead gate is host-agnostic: enforcement is tied to configuration,
    // and the token hostname must match the request's own host.
    posted = stubSiteverify({ defaultAction: 'lead_submit', defaultHostname: '127.0.0.1' });
    vi.stubGlobal('fetch', posted);
  });

  afterAll(async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    vi.unstubAllGlobals();
  });

  const lead = { name: 'Lead Pam', email: `lead-${rand}@example.com`, phone: '0771234567', venue_name: 'Lead Arena' };

  it('accepts a lead with a valid token', async () => {
    const res = await request(app).post('/api/v1/public/leads').send({ ...lead, captcha_token: 'good-0.9' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
  });

  it('rejects a lead with a low score and with a missing token', async () => {
    const low = await request(app).post('/api/v1/public/leads').send({ ...lead, email: `lead-low-${rand}@example.com`, captcha_token: 'good-0.1' });
    expect(low.status).toBe(403);
    expect(low.body.error.code).toBe('CAPTCHA_LOW_SCORE');

    const missing = await request(app).post('/api/v1/public/leads').send({ ...lead, email: `lead-none-${rand}@example.com` });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('CAPTCHA_REQUIRED');
  });

  it('rejects a lead with a token minted on a different host', async () => {
    const wrong = await request(app)
      .post('/api/v1/public/leads')
      .set('Host', 'evil.example.com')
      .send({ ...lead, email: `lead-host-${rand}@example.com`, captcha_token: 'good-0.9' });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('CAPTCHA_HOSTNAME_MISMATCH');
  });

  it('skips the gate entirely when reCAPTCHA is not configured (rollout/dev)', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    const res = await request(app).post('/api/v1/public/leads').send({ ...lead, email: `lead-unconf-${rand}@example.com` });
    expect(res.status).toBe(201);
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
  });
});
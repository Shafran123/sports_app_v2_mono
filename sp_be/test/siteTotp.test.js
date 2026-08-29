// Second Factor (tickets 07-08): Site Customer TOTP on our own auth stack.
// Enrollment (secret encrypted at rest, ten single-use backup codes shown
// once), server-side verification at sign-in (email+password and Google —
// a session is issued only after the challenge passes), the per-Business
// require toggle, and recovery (owner for their own Business, admin as
// backstop) which also revokes all of the customer's active sessions.

const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const siteTotp = require('../services/siteTotp');
const { enableSms } = require('./helpers/flags');

let BUSINESS;
let posted;

const rand = Math.random().toString(36).slice(2, 10);

async function tokenFor(uid, extra = {}) {
  const { SignJWT } = require('jose');
  return new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret'));
}

const registerAt = (host, email, password = 'correct-horse-9') =>
  request(app).post('/api/v1/site-auth/register').send({ site_hostname: host, email, name: 'Totp Pam', password });

async function enrolledCustomer(email, password = 'correct-horse-9') {
  const reg = await registerAt('site-totp.test', email, password);
  const token = reg.body.data.token;
  const start = await request(app).post('/api/v1/site-auth/totp/enable').set('Authorization', `Bearer ${token}`).send({});
  expect(start.status).toBe(200);
  const secret = start.body.data.secret;
  const code = siteTotp.totpCode(secret);
  const confirm = await request(app).post('/api/v1/site-auth/totp/enable/confirm').set('Authorization', `Bearer ${token}`).send({ code });
  expect(confirm.status).toBe(200);
  return { customerId: reg.body.data.customer.id, token, secret, backupCodes: confirm.body.data.backup_codes };
}

describe('site customer second factor (tickets 07-08)', () => {
  beforeAll(async () => {
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || 'totp-test-encryption-key';
    await enableSms();
    posted = vi.fn(async (_url, opts) => ({ ok: true, status: 200, text: async () => '', json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', posted);

    const owner = await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ($1, $2, 'Totp Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set role = 'venue_owner', onboarding_state = 'accepted'
       returning id`,
      [`site-totp-owner-${rand}`, `totp-owner-${rand}@myslot.test`]
    );
    const business = await pool.query(`insert into businesses (owner_id, name) values ($1, 'Totp Business') returning *`, [owner.rows[0].id]);
    BUSINESS = business.rows[0];
    await pool.query(
      `insert into site_domain_requests (business_id, hostname, hostname_kind, status, dns_type, dns_name, dns_value)
       values ($1, 'site-totp.test', 'custom', 'live', 'TXT', 'site-totp.test', 'token=abc')`,
      [BUSINESS.id]
    );
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status)
       values ('site-totp-admin', 'totp-admin@myslot.test', 'Totp Admin', 'admin', 'active')
       on conflict (firebase_uid) do update set role = 'admin'`
    );
    await pool.query(`delete from site_customers where business_id = $1`, [BUSINESS.id]);
  });

  it('unit: TOTP codes round-trip and reject wrong codes; secrets encrypt at rest', () => {
    const secret = siteTotp.generateSecret();
    const code = siteTotp.totpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(siteTotp.verifyCode(secret, code)).toBe(true);
    expect(siteTotp.verifyCode(secret, '000000')).toBe(false);
    expect(siteTotp.verifyCode(secret, '12345')).toBe(false);
    expect(siteTotp.verifyCode(secret, '')).toBe(false);

    const enc = siteTotp.encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(siteTotp.decryptSecret(enc)).toBe(secret);
    expect(siteTotp.decryptSecret(enc.slice(0, -4) + 'ffff')).toBeNull();
    expect(siteTotp.decryptSecret('garbage')).toBeNull();
  });

  it('enrolls: secret returned once and stored encrypted; wrong code does not enable', async () => {
    const email = `enroll-${rand}@abc.test`;
    const reg = await registerAt('site-totp.test', email);
    const token = reg.body.data.token;

    const start = await request(app).post('/api/v1/site-auth/totp/enable').set('Authorization', `Bearer ${token}`).send({});
    expect(start.status).toBe(200);
    const { secret, otpauth_url } = start.body.data;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauth_url).toContain(`secret=${secret}`);
    expect(otpauth_url).toContain('otpauth://totp/');

    // Encrypted at rest: the plaintext secret never lands in the DB.
    const { rows } = await pool.query(`select totp_secret_enc, totp_enabled_at from site_customers where id = $1`, [reg.body.data.customer.id]);
    expect(rows[0].totp_secret_enc).toBeTruthy();
    expect(rows[0].totp_secret_enc).not.toContain(secret);
    expect(rows[0].totp_enabled_at).toBeNull();

    const me = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.totp_enabled).toBe(false);

    const bad = await request(app).post('/api/v1/site-auth/totp/enable/confirm').set('Authorization', `Bearer ${token}`).send({ code: '123456' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('TOTP_INVALID');

    const good = await request(app).post('/api/v1/site-auth/totp/enable/confirm').set('Authorization', `Bearer ${token}`).send({ code: siteTotp.totpCode(secret) });
    expect(good.status).toBe(200);
    expect(good.body.data.enabled).toBe(true);
    expect(good.body.data.backup_codes).toHaveLength(10);
    expect(good.body.data.backup_codes.every((c) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c))).toBe(true);

    const { rows: after } = await pool.query(`select totp_enabled_at from site_customers where id = $1`, [reg.body.data.customer.id]);
    expect(after[0].totp_enabled_at).toBeTruthy();
    // Backup codes are stored hashed, never in plaintext.
    const { rows: codes } = await pool.query(`select code_hash from site_customer_backup_codes where site_customer_id = $1`, [reg.body.data.customer.id]);
    expect(codes).toHaveLength(10);
    expect(codes.every((c) => !good.body.data.backup_codes.includes(c.code_hash))).toBe(true);

    // Enabling twice is refused.
    const again = await request(app).post('/api/v1/site-auth/totp/enable').set('Authorization', `Bearer ${token}`).send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TOTP_ALREADY_ENABLED');
  });

  it('challenges an enrolled customer at email+password sign-in; wrong code issues no session', async () => {
    const email = `challenge-${rand}@abc.test`;
    const { secret } = await enrolledCustomer(email, 'password-1');

    const login = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-1' });
    expect(login.status).toBe(202);
    expect(login.body.data.escalated).toBe(true);
    expect(login.body.data.kind).toBe('totp');
    expect(login.body.data.token).toBeUndefined();
    expect(login.body.data.challenge_id).toBeTruthy();

    const wrong = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: login.body.data.challenge_id, code: '123456' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('TOTP_INVALID');

    // A wrong code does not consume the challenge — the same one still works.
    const good = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: login.body.data.challenge_id, code: siteTotp.totpCode(secret) });
    expect(good.status).toBe(200);
    expect(good.body.data.token).toMatch(/^[0-9a-f]{64}$/);
    const me = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${good.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
    expect(me.body.data.totp_enabled).toBe(true);
  });

  it('redeems a backup code once at sign-in; a reused code is dead', async () => {
    const email = `backup-${rand}@abc.test`;
    const { backupCodes } = await enrolledCustomer(email, 'password-2');

    const first = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-2' });
    expect(first.status).toBe(202);
    const ok = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: first.body.data.challenge_id, code: backupCodes[0] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toBeTruthy();

    const second = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-2' });
    expect(second.status).toBe(202);
    const reuse = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: second.body.data.challenge_id, code: backupCodes[0] });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('TOTP_INVALID');
  });

  it('challenges an enrolled customer on the Google path before a session', async () => {
    const email = `g-${rand}@gmail.test`;
    const gToken = await tokenFor(`gtotp-${rand}`, { sub: `gsubtotp-${rand}`, name: 'Google Totp', email });
    const google = await request(app).post('/api/v1/site-auth/google').send({ site_hostname: 'site-totp.test', id_token: gToken });
    expect(google.status).toBe(201);

    // Enroll the Google-created customer (enrollment happens in the account
    // panel, on a session issued before the factor existed).
    const token = google.body.data.token;
    const start = await request(app).post('/api/v1/site-auth/totp/enable').set('Authorization', `Bearer ${token}`).send({});
    const secret = start.body.data.secret;
    const confirm = await request(app).post('/api/v1/site-auth/totp/enable/confirm').set('Authorization', `Bearer ${token}`).send({ code: siteTotp.totpCode(secret) });
    expect(confirm.status).toBe(200);
    const customerId = google.body.data.customer.id;

    const second = await request(app).post('/api/v1/site-auth/google').send({ site_hostname: 'site-totp.test', id_token: gToken });
    expect(second.status).toBe(202);
    expect(second.body.data.escalated).toBe(true);
    expect(second.body.data.kind).toBe('totp');
    expect(second.body.data.token).toBeUndefined();

    const good = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: second.body.data.challenge_id, code: siteTotp.totpCode(secret) });
    expect(good.status).toBe(200);
    expect(good.body.data.customer.id).toBe(customerId);
  });

  it('regenerates backup codes; the old set dies', async () => {
    const email = `regen-${rand}@abc.test`;
    const { token, backupCodes } = await enrolledCustomer(email, 'password-3');

    const regen = await request(app).post('/api/v1/site-auth/totp/backup-codes/regenerate').set('Authorization', `Bearer ${token}`).send({});
    expect(regen.status).toBe(200);
    expect(regen.body.data.backup_codes).toHaveLength(10);
    expect(regen.body.data.backup_codes.some((c) => backupCodes.includes(c))).toBe(false);

    const login = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-3' });
    expect(login.status).toBe(202);
    const old = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: login.body.data.challenge_id, code: backupCodes[0] });
    expect(old.status).toBe(400);

    const login2 = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-3' });
    const fresh = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: login2.body.data.challenge_id, code: regen.body.data.backup_codes[0] });
    expect(fresh.status).toBe(200);
  });

  it('enforces the per-Business require toggle at sign-in (both paths) and still challenges enrolled customers', async () => {
    const email = `req-${rand}@abc.test`;
    await registerAt('site-totp.test', email, 'password-4');
    await pool.query(`update businesses set require_2fa = true where id = $1`, [BUSINESS.id]);

    const login = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-4' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('SECOND_FACTOR_REQUIRED');

    const gToken = await tokenFor(`greq-${rand}`, { sub: `gsubreq-${rand}`, name: 'Req Totp', email });
    const google = await request(app).post('/api/v1/site-auth/google').send({ site_hostname: 'site-totp.test', id_token: gToken });
    expect(google.status).toBe(403);
    expect(google.body.error.code).toBe('SECOND_FACTOR_REQUIRED');

    // An enrolled customer is still challenged (never bypassed).
    const enrolled = await enrolledCustomer(`req2-${rand}@abc.test`, 'password-4');
    const loginEnrolled = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email: `req2-${rand}@abc.test`, password: 'password-4' });
    expect(loginEnrolled.status).toBe(202);
    const ok = await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: loginEnrolled.body.data.challenge_id, code: siteTotp.totpCode(enrolled.secret) });
    expect(ok.status).toBe(200);

    // With the toggle off the unenrolled customer signs in normally again.
    await pool.query(`update businesses set require_2fa = false where id = $1`, [BUSINESS.id]);
    const relaxed = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-4' });
    expect(relaxed.status).toBe(200);
    expect(relaxed.body.data.token).toBeTruthy();
  });

  it('disables the factor with a live code (or backup code) and deletes the codes', async () => {
    const email = `disable-${rand}@abc.test`;
    const { token, secret, backupCodes } = await enrolledCustomer(email, 'password-5');

    const bad = await request(app).post('/api/v1/site-auth/totp/disable').set('Authorization', `Bearer ${token}`).send({ code: '000000' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('TOTP_INVALID');

    const ok = await request(app).post('/api/v1/site-auth/totp/disable').set('Authorization', `Bearer ${token}`).send({ code: siteTotp.totpCode(secret) });
    expect(ok.status).toBe(200);
    const direct = await pool.query(`select totp_enabled_at, totp_secret_enc from site_customers where email = $1`, [email]);
    expect(direct.rows[0].totp_enabled_at).toBeNull();
    expect(direct.rows[0].totp_secret_enc).toBeNull();
    const customerRow = await pool.query(`select id from site_customers where email = $1`, [email]);
    const codes = await pool.query(`select count(*)::int as n from site_customer_backup_codes where site_customer_id = $1`, [customerRow.rows[0].id]);
    expect(codes.rows[0].n).toBe(0);
    expect(backupCodes).toHaveLength(10);

    // Disabled customer signs in without a challenge.
    const login = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-5' });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();
  });

  it('refuses disabling when the business requires the factor', async () => {
    const email = `locked-${rand}@abc.test`;
    const { token, secret } = await enrolledCustomer(email, 'password-6');
    await pool.query(`update businesses set require_2fa = true where id = $1`, [BUSINESS.id]);

    const res = await request(app).post('/api/v1/site-auth/totp/disable').set('Authorization', `Bearer ${token}`).send({ code: siteTotp.totpCode(secret) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SECOND_FACTOR_REQUIRED');

    await pool.query(`update businesses set require_2fa = false where id = $1`, [BUSINESS.id]);
  });

  it('owner reset clears the factor AND revokes every active session', async () => {
    const email = `ownerreset-${rand}@abc.test`;
    const { token, secret } = await enrolledCustomer(email, 'password-7');

    // A second session on another surface (e.g. the widget) — must die too.
    const secondLogin = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-7' });
    expect(secondLogin.status).toBe(202);
    const secondToken = (await request(app).post('/api/v1/site-auth/challenge/confirm').send({ challenge_id: secondLogin.body.data.challenge_id, code: siteTotp.totpCode(secret) })).body.data.token;

    const ownerToken = await tokenFor(`site-totp-owner-${rand}`);
    const otherOwner = await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ($1, $2, 'Other Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set role = 'venue_owner', onboarding_state = 'accepted'
       returning id`,
      [`site-totp-other-${rand}`, `totp-other-${rand}@myslot.test`]
    );
    await pool.query(`insert into businesses (owner_id, name) values ($1, 'Other Business')`, [otherOwner.rows[0].id]);

    const customerId = (await pool.query(`select id from site_customers where email = $1`, [email])).rows[0].id;
    const foreign = await request(app)
      .post(`/api/v1/business/customers/${customerId}/reset-factor`)
      .set('Authorization', `Bearer ${await tokenFor(`site-totp-other-${rand}`)}`);
    expect(foreign.status).toBe(404);

    const reset = await request(app)
      .post(`/api/v1/business/customers/${customerId}/reset-factor`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reset.status).toBe(200);

    const after = await pool.query(`select totp_enabled_at, totp_secret_enc from site_customers where id = $1`, [customerId]);
    expect(after.rows[0].totp_enabled_at).toBeNull();
    expect(after.rows[0].totp_secret_enc).toBeNull();
    const codes = await pool.query(`select count(*)::int as n from site_customer_backup_codes where site_customer_id = $1`, [customerId]);
    expect(codes.rows[0].n).toBe(0);

    const oldMe = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${token}`);
    expect(oldMe.status).toBe(401);
    const widgetMe = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${secondToken}`);
    expect(widgetMe.status).toBe(401);

    // Factor gone: the customer signs in with plain credentials again.
    const login = await request(app).post('/api/v1/site-auth/login').send({ site_hostname: 'site-totp.test', email, password: 'password-7' });
    expect(login.status).toBe(200);
  });

  it('admin backstop resets any customer factor and revokes sessions', async () => {
    const email = `adminreset-${rand}@abc.test`;
    const { token } = await enrolledCustomer(email, 'password-8');

    const customerId = (await pool.query(`select id from site_customers where email = $1`, [email])).rows[0].id;
    const reset = await request(app)
      .post(`/api/v1/admin/sites/customers/${customerId}/reset-factor`)
      .set('Authorization', `Bearer ${await tokenFor('site-totp-admin')}`);
    expect(reset.status).toBe(200);

    const after = await pool.query(`select totp_enabled_at from site_customers where id = $1`, [customerId]);
    expect(after.rows[0].totp_enabled_at).toBeNull();

    const oldMe = await request(app).get('/api/v1/site-auth/me').set('Authorization', `Bearer ${token}`);
    expect(oldMe.status).toBe(401);

    // A non-admin is refused the backstop.
    const player = await request(app)
      .post(`/api/v1/admin/sites/customers/${customerId}/reset-factor`)
      .set('Authorization', `Bearer ${await tokenFor(`site-totp-player-${rand}`)}`);
    expect(player.status).toBe(403);
  });

  it('the Anti-bot escalation path still honors the Second Factor (tickets 07-08)', async () => {
    // Drive the low-score escalation: a `good-<score>-<action>` captcha token
    // answers siteverify with that score for the live site hostname.
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    const base = posted;
    const captchaFetch = vi.fn(async (url, opts) => {
      if (String(url).includes('siteverify')) {
        const body = new URLSearchParams(String(opts?.body || ''));
        const token = body.get('response') || '';
        const [_, score, action] = token.split('-');
        return {
          ok: true, status: 200, json: async () => ({
            success: true, score: Number(score) || 0.9, action: action || 'site_login', hostname: 'site-totp.test'
          })
        };
      }
      return base(url, opts);
    });
    vi.stubGlobal('fetch', captchaFetch);
    const atSite = (req) => req.set('Host', 'site-totp.test');

    // Enrolled customer: a low score must NOT email-code a session past the
    // factor — the escalation itself becomes a TOTP challenge.
    const email = `escalate-${rand}@abc.test`;
    const { secret } = await enrolledCustomer(email, 'password-a');
    const low = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: 'site-totp.test', email, password: 'password-a', captcha_token: 'good-0.1-site_login'
    });
    expect(low.status).toBe(202);
    expect(low.body.data.escalated).toBe(true);
    expect(low.body.data.kind).toBe('totp');
    expect(low.body.data.token).toBeUndefined();
    // No emailed code — the factor itself is the human proof.
    expect(captchaFetch.mock.calls.some(([u]) => String(u).includes('mailgun'))).toBe(false);

    const good = await request(app).post('/api/v1/site-auth/challenge/confirm').send({
      challenge_id: low.body.data.challenge_id, code: siteTotp.totpCode(secret)
    });
    expect(good.status).toBe(200);
    expect(good.body.data.token).toMatch(/^[0-9a-f]{64}$/);

    // Required Business + unenrolled customer: the escalation refuses
    // outright — the email-OTP path never mints a session past the factor.
    await pool.query(`update businesses set require_2fa = true where id = $1`, [BUSINESS.id]);
    const unenrolled = `escalate-req-${rand}@abc.test`;
    const reg = await atSite(request(app).post('/api/v1/site-auth/register')).send({
      site_hostname: 'site-totp.test', email: unenrolled, name: 'Req Esc', password: 'password-b', captcha_token: 'good-0.9-site_register'
    });
    expect(reg.status).toBe(201);
    const low2 = await atSite(request(app).post('/api/v1/site-auth/login')).send({
      site_hostname: 'site-totp.test', email: unenrolled, password: 'password-b', captcha_token: 'good-0.1-site_login'
    });
    expect(low2.status).toBe(403);
    expect(low2.body.error.code).toBe('SECOND_FACTOR_REQUIRED');
    await pool.query(`update businesses set require_2fa = false where id = $1`, [BUSINESS.id]);
    delete process.env.RECAPTCHA_SECRET_KEY;
    vi.stubGlobal('fetch', posted);
  });

  it('surfaces totp state on the owner customers directory', async () => {
    const email = `dir-${rand}@abc.test`;
    await enrolledCustomer(email, 'password-9');
    const ownerToken = await tokenFor(`site-totp-owner-${rand}`);
    const res = await request(app).get('/api/v1/business/customers').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find((c) => c.email === email);
    expect(row).toBeTruthy();
    expect(row.totp_enabled_at).toBeTruthy();
  });
});
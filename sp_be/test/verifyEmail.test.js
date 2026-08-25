const request = require('supertest');
const { SignJWT } = require('jose');
const crypto = require('node:crypto');
const pool = require('../db');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');

function tokenFor(uid, email) {
  return new SignJWT({ uid, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);
}

const UID = `verify-email-${Date.now()}`;
const EMAIL = 'verify-email@example.com';
let token;
let posted;

function codeFromEmail(email) {
  const call = posted.mock.calls.findLast(
    ([, opts]) => {
      const form = new URLSearchParams(String(opts.body));
      return form.get('to') === email;
    }
  );
  if (!call) return null;
  const form = new URLSearchParams(String(call[1].body));
  const match = String(form.get('html')).match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

describe('email verification — Verified Email OTP challenge', () => {
  beforeAll(async () => {
    token = await tokenFor(UID, EMAIL);
    await pool.query(
      `insert into users (firebase_uid, email, email_verified_at) values ($1, $2, now()) on conflict (firebase_uid) do nothing`,
      [UID, EMAIL]
    );
  });

  beforeEach(async () => {
    posted = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', posted);
    process.env.MAILGUN_API_KEY = 'mg_test_key';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    await pool.query(
      `delete from verification_email_otps where user_id = (select id from users where firebase_uid = $1)`,
      [UID]
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  it('rejects send without login', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email/send').send({ email: EMAIL });
    expect(res.status).toBe(401);
  });

  it('sends an OTP via Mailgun and never returns the code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);

    expect(posted).toHaveBeenCalledTimes(1);
    const [, opts] = posted.mock.calls[0];
    const body = new URLSearchParams(String(opts.body));
    expect(body.get('to')).toBe(EMAIL);
    expect(body.get('subject')).toContain('verification code');
    expect(codeFromEmail(EMAIL)).toMatch(/^\d{6}$/);
  });

  it('stores a salted hash, never the plaintext code', async () => {
    await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });

    const code = codeFromEmail(EMAIL);
    const { rows } = await pool.query(
      `select code_hash from verification_email_otps o join users u on u.id = o.user_id where u.firebase_uid = $1 order by o.created_at desc limit 1`,
      [UID]
    );
    expect(rows[0].code_hash).not.toBe(code);
    expect(rows[0].code_hash).not.toBe(crypto.createHash('sha256').update(code).digest('hex'));
  });

  it('confirms with the emailed code and marks the user verified', async () => {
    await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });

    const code = codeFromEmail(EMAIL);
    const res = await request(app)
      .post('/api/v1/auth/verify-email/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL, code });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(EMAIL);
    expect(res.body.data.email_verified_at).not.toBeNull();

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.email_verified_at).not.toBeNull();
  });

  it('rejects a wrong code and locks after five attempts', async () => {
    await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/verify-email/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: EMAIL, code: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    }

    const last = await request(app)
      .post('/api/v1/auth/verify-email/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL, code: '000000' });
    expect(last.status).toBe(400);
    expect(last.body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('rejects an expired code', async () => {
    await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });

    await pool.query(`update verification_email_otps set expires_at = now() - interval '1 minute'`);

    const code = codeFromEmail(EMAIL);
    const res = await request(app)
      .post('/api/v1/auth/verify-email/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL, code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('blocks resend within 60 seconds', async () => {
    const first = await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });
    expect(first.status).toBe(200);

    const resend = await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: EMAIL });
    expect(resend.status).toBe(429);
    expect(resend.body.error.code).toBe('OTP_RESEND_TOO_SOON');
    expect(resend.body.error.message).toContain('60');
  });

  it('rate-limits to five sends per address per hour', async () => {
    const { rows } = await pool.query(
      `select id from users where firebase_uid = $1`,
      [UID]
    );
    for (let i = 0; i < 5; i++) {
      await pool.query(
        `insert into verification_email_otps (user_id, email, code_hash, salt, expires_at, created_at)
         values ($1, 'other@example.com', $2, 'fixedsalt', now() + interval '10 minutes', now() - interval '10 minutes')`,
        [rows[0].id, crypto.createHash('sha256').update('000000').digest('hex')]
      );
    }

    const res = await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'other@example.com' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_RATE_LIMITED');
  });

  it('returns an error and stores nothing when Mailgun fails the send', async () => {
    posted = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    vi.stubGlobal('fetch', posted);

    const res = await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'newmail@example.com' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_SEND_FAILED');

    const { rows } = await pool.query(
      `select count(*)::int as n from verification_email_otps where email = 'newmail@example.com'`
    );
    expect(rows[0].n).toBe(0);
  });

  it('swaps to a new address and re-verifies it on confirm', async () => {
    const NEW = 'changed@example.com';
    await request(app)
      .post('/api/v1/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: NEW });

    const code = codeFromEmail(NEW);
    const res = await request(app)
      .post('/api/v1/auth/verify-email/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: NEW, code });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(NEW);
    expect(res.body.data.email_verified_at).not.toBeNull();
  });
});
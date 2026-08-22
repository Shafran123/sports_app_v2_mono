const request = require('supertest');
const { SignJWT } = require('jose');
const crypto = require('node:crypto');
const pool = require('../db');
const app = require('../app');
const { enableSms, resetFlagsToDefaults } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');

function tokenFor(uid, email) {
  return new SignJWT({ uid, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);
}

const UID = `verify-${Date.now()}`;
let token;
let posted;

function codeFromSms(phone) {
  const call = posted.mock.calls.findLast(
    ([, opts]) => JSON.parse(opts.body).to === phone
  );
  if (!call) return null;
  const match = String(JSON.parse(call[1].body).message).match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

describe('phone verification — SMSGo OTP challenge', () => {
  beforeAll(async () => {
    token = await tokenFor(UID, 'verify@spots.lk');
    await pool.query(
      `insert into users (firebase_uid, email) values ($1, $2) on conflict (firebase_uid) do nothing`,
      [UID, 'verify@spots.lk']
    );
    // OTP channel requires the sms_enabled flag (defaults OFF until SMSGo
    // is live); flip it on for this suite.
    await enableSms();
  });

  beforeEach(async () => {
    posted = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', posted);
    process.env.SMSGO_API_KEY = 'sg_test_key';
    await pool.query(
      `delete from verification_otps where user_id = (select id from users where firebase_uid = $1)`,
      [UID]
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SMSGO_API_KEY;
  });

  afterAll(async () => {
    await resetFlagsToDefaults();
  });

  it('rejects send without login', async () => {
    const res = await request(app).post('/api/v1/auth/verify-phone/send').send({ phone: '+94771234567' });
    expect(res.status).toBe(401);
  });

  it('sends an OTP via SMSGo and never returns the code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '077 123 4567' });

    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/);

    expect(posted).toHaveBeenCalledTimes(1);
    const [, opts] = posted.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.to).toBe('+94771234567');
    expect(body.mask).toBe('SPOTS');
    expect(body.message).toContain('verification code');
    expect(codeFromSms('+94771234567')).toMatch(/^\d{6}$/);
  });

  it('stores a salted hash, never the plaintext code and never an unsalted sha256', async () => {
    await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });

    const code = codeFromSms('+94771234567');
    const { rows } = await pool.query(
      `select code_hash from verification_otps o join users u on u.id = o.user_id where u.firebase_uid = $1 order by o.created_at desc limit 1`,
      [UID]
    );
    expect(rows[0].code_hash).not.toBe(code);
    expect(rows[0].code_hash).not.toBe(crypto.createHash('sha256').update(code).digest('hex'));

    // Two sends of the same code must produce different hashes (salt per code)
    const { rows: userRows } = await pool.query(
      `select id from users where firebase_uid = $1`,
      [UID]
    );
    const { rows: otpRows } = await pool.query(
      `select code_hash from verification_otps where user_id = $1`,
      [userRows[0].id]
    );
    if (otpRows.length > 1) {
      expect(new Set(otpRows.map((r) => r.code_hash)).size).toBe(otpRows.length);
    }
  });

  it('confirms with the SMS code and marks the user verified', async () => {
    const sendRes = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });
    expect(sendRes.status).toBe(200);

    const code = codeFromSms('+94771234567');
    const res = await request(app)
      .post('/api/v1/auth/verify-phone/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567', code });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+94771234567');
    expect(res.body.data.phone_verified_at).not.toBeNull();

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.data.phone_verified_at).not.toBeNull();
  });

  it('rejects a wrong code and locks after five attempts', async () => {
    await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/verify-phone/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+94771234567', code: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    }

    const last = await request(app)
      .post('/api/v1/auth/verify-phone/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567', code: '000000' });
    expect(last.status).toBe(400);
    expect(last.body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('rejects an expired code', async () => {
    const sendRes = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });
    expect(sendRes.status).toBe(200);

    await pool.query(`update verification_otps set expires_at = now() - interval '1 minute'`);

    const code = codeFromSms('+94771234567');
    const res = await request(app)
      .post('/api/v1/auth/verify-phone/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567', code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('blocks resend within 60 seconds', async () => {
    const first = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });
    expect(first.status).toBe(200);

    const resend = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });
    expect(resend.status).toBe(429);
    expect(resend.body.error.code).toBe('OTP_RESEND_TOO_SOON');
    expect(resend.body.error.message).toContain('60');
  });

  it('rate-limits to five sends per phone per hour', async () => {
    const { rows } = await pool.query(
      `select id from users where firebase_uid = $1`,
      [UID]
    );
    for (let i = 0; i < 5; i++) {
      await pool.query(
        `insert into verification_otps (user_id, phone, code_hash, salt, expires_at, created_at)
         values ($1, $2, $3, $4, now() + interval '10 minutes', now() - interval '10 minutes')`,
        [rows[0].id, '+94777777777', crypto.createHash('sha256').update('000000').digest('hex'), 'fixedsalt']
      );
    }

    const res = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94777777777' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_RATE_LIMITED');
  });

  it('rate-limits to five sends per user per hour across numbers', async () => {
    const { rows } = await pool.query(
      `select id from users where firebase_uid = $1`,
      [UID]
    );
    for (let i = 0; i < 5; i++) {
      await pool.query(
        `insert into verification_otps (user_id, phone, code_hash, salt, expires_at, created_at)
         values ($1, $2, $3, $4, now() + interval '10 minutes', now() - interval '10 minutes')`,
        [rows[0].id, `+9477000000${i}`, crypto.createHash('sha256').update('000000').digest('hex'), 'fixedsalt']
      );
    }

    const res = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94778888888' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_RATE_LIMITED');
  });

  it('returns an error and stores nothing when SMSGo throttles the send', async () => {
    posted = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ statusCode: 429, message: 'ThrottlerException: Too Many Requests' })
    }));
    vi.stubGlobal('fetch', posted);
    process.env.SMSGO_API_KEY = 'sg_test';

    const res = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771713701' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('SMS_SEND_FAILED');

    const { rows } = await pool.query(
      `select count(*)::int as n from verification_otps where phone = '+94771713701'`
    );
    expect(rows[0].n).toBe(0);

    posted = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', posted);
    const again = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771713701' });

    expect(again.status).toBe(200);
  });

  it('invalidates an outstanding code when a new one is sent for the same phone', async () => {
    const first = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });
    expect(first.status).toBe(200);
    const oldCode = codeFromSms('+94771234567');

    await pool.query(
      `update verification_otps set created_at = now() - interval '2 minutes' where user_id = (select id from users where firebase_uid = $1)`,
      [UID]
    );

    const second = await request(app)
      .post('/api/v1/auth/verify-phone/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567' });
    expect(second.status).toBe(200);

    const stale = await request(app)
      .post('/api/v1/auth/verify-phone/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+94771234567', code: oldCode });
    expect(stale.status).toBe(400);
    expect(stale.body.error.code).toBe('OTP_INVALID');
  });
});
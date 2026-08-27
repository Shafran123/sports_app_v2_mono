// Site Customer auth (ADR-0030): per-Business identities with our own auth —
// email+password (scrypt), bearer-token sessions, per-Business phone/email
// OTP verification, and Google sign-in mapped to a per-Business profile.
// Firebase stays for platform accounts (Player, Venue Owner, Admin) — this
// service never touches the `users` table.

const crypto = require('node:crypto');
const pool = require('../db');
const siteDomains = require('./siteDomains');
const { formatSriLankanPhone } = require('../utils/smsService');
const { sendSms } = require('../utils/smsService');
const { sendEmail, buildVerificationCodeHtml } = require('../utils/emailService');
const { getBrandName } = require('../utils/featureFlags');
const { recordOutbound } = require('../utils/notificationCatalog');

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

const SESSION_TTL_DAYS = 30;
const ROTATION_WINDOW_HOURS = 24;
const MAX_SESSIONS = 20;

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_WINDOW_SECONDS = 60;
const HOURLY_SEND_LIMIT = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Business resolution: every auth call carries the site hostname it is acting
// for; only a LIVE site's Business may create/verify Site Customers.
async function liveBusinessForHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    throw Object.assign(new Error('A live site hostname is required'), { code: 'SITE_HOST_REQUIRED' });
  }
  const row = await siteDomains.liveByHostname(hostname.trim());
  if (!row) {
    throw Object.assign(new Error('This hostname is not a live dedicated site'), { code: 'SITE_HOST_NOT_LIVE' });
  }
  return { businessId: row.business_id, requestRow: row };
}

// ---- Passwords (scrypt, per-user salt) ----

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = Buffer.from(parts[5], 'hex');
  const actual = crypto.scryptSync(String(password), salt, KEY_LEN, { N: n, r, p });
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// ---- Sessions ----

function issueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function tokenHash(token) {
  return crypto.createHmac('sha256', process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET).update(token).digest('hex');
}

async function createSession(customerId, client = pool) {
  // Cap active sessions per customer: prune expired + oldest beyond the cap.
  await client.query(
    `delete from site_customer_sessions s
     where s.site_customer_id = $1 and (
       s.expires_at < now()
       or s.id in (
         select id from (
           select id from site_customer_sessions
           where site_customer_id = $1 and expires_at > now()
           order by created_at desc offset $2
         ) over
       )
     )`,
    [customerId, MAX_SESSIONS - 1]
  ).catch(() => {
    // The windowed prune above is deliberately simple; ignoring a prune
    // failure never breaks session issuance.
  });
  const token = issueToken();
  const { rows } = await client.query(
    `insert into site_customer_sessions (site_customer_id, token_hash, expires_at)
     values ($1, $2, now() + interval '${SESSION_TTL_DAYS} days')
     returning expires_at`,
    [customerId, tokenHash(token)]
  );
  return { token, expires_at: rows[0].expires_at };
}

// Resolve a bearer token to its Site Customer (+ business) or null.
async function customerForToken(token) {
  const { rows } = await pool.query(
    `select sc.*, b.name as business_name
     from site_customer_sessions s
     join site_customers sc on sc.id = s.site_customer_id
     join businesses b on b.id = sc.business_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash(String(token || ''))]
  );
  const customer = rows[0] || null;
  if (customer) {
    await pool.query(
      `update site_customer_sessions set last_used_at = now()
       where token_hash = $1`,
      [tokenHash(String(token))]
    );
  }
  return customer;
}

async function revokeToken(token) {
  await pool.query(`delete from site_customer_sessions where token_hash = $1`, [tokenHash(String(token || ''))]);
}

// ---- OTP (mirrors the platform verification_otps hardening) ----

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, salt) {
  return crypto.createHmac('sha256', process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET).update(`${salt}${code}`).digest('hex');
}

function timingSafeEqualHex(a, b) {
  const aBuf = Buffer.from(String(a || ''), 'hex');
  const bBuf = Buffer.from(String(b || ''), 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function findActiveOtp(customerId, channel, target) {
  const { rows } = await pool.query(
    `select id, code_hash, salt, expires_at, attempts from site_customer_otps
     where site_customer_id = $1 and channel = $2 and target = $3
     order by created_at desc limit 1`,
    [customerId, channel, target]
  );
  return rows[0] || null;
}

async function verifyOtp(customerId, channel, target, code) {
  const row = await findActiveOtp(customerId, channel, target);
  if (!row || new Date(row.expires_at) < new Date()) {
    throw Object.assign(new Error('The code has expired. Request a new one.'), { code: 'OTP_EXPIRED' });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(new Error('Too many attempts. Request a new code.'), { code: 'OTP_TOO_MANY_ATTEMPTS' });
  }
  await pool.query(`update site_customer_otps set attempts = attempts + 1 where id = $1`, [row.id]);
  if (!timingSafeEqualHex(hashCode(String(code), row.salt), row.code_hash)) {
    throw Object.assign(new Error('That code is not correct.'), { code: 'OTP_INVALID' });
  }
  await pool.query(`delete from site_customer_otps where id = $1`, [row.id]);
}

// ---- Public operations ----

// Register an email+password Site Customer inside a live site's Business.
// Same email at another Business creates a fully independent account.
async function register({ site_hostname, name, email, password }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim().slice(0, 80);
  if (!EMAIL_RE.test(cleanEmail)) {
    throw Object.assign(new Error('Enter a valid email address.'), { code: 'EMAIL_INVALID' });
  }
  if (!password || String(password).length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters.'), { code: 'PASSWORD_WEAK' });
  }
  const { rows } = await pool.query(
    `insert into site_customers (business_id, email, name, password_hash)
     values ($1, $2, $3, $4)
     returning *`,
    [businessId, cleanEmail, cleanName, hashPassword(String(password))]
  ).catch((error) => {
    if (error.code === '23505') {
      throw Object.assign(new Error('An account with this email already exists at this site.'), { code: 'SITE_CUSTOMER_EXISTS' });
    }
    throw error;
  });
  const session = await createSession(rows[0].id);
  return { customer: rows[0], session };
}

async function login({ site_hostname, email, password }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const { rows } = await pool.query(
    `select * from site_customers where business_id = $1 and lower(email) = $2`,
    [businessId, cleanEmail]
  );
  const customer = rows[0] || null;
  if (!customer || !verifyPassword(String(password || ''), customer.password_hash)) {
    throw Object.assign(new Error('Incorrect email or password.'), { code: 'SITE_CUSTOMER_BAD_CREDENTIALS' });
  }
  const session = await createSession(customer.id);
  return { customer, session };
}

// Google sign-in: map a verified Google identity to a per-Business Site
// Customer. The client hands us the Firebase ID token; we verify it with the
// Admin SDK (never trust client-supplied identity), then resolve the Business
// from the live site hostname. Merge order per Business: existing
// (business_id, google_sub) row, else existing (business_id, email) row
// (link the Google identity onto it — one human, one customer), else create.
async function googleUpsert({ site_hostname, id_token }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  if (!id_token || typeof id_token !== 'string') {
    throw Object.assign(new Error('A Google ID token is required.'), { code: 'GOOGLE_TOKEN_REQUIRED' });
  }
  const { verifyIdToken } = require('../middleware/authenticate');
  let decoded;
  try {
    decoded = await verifyIdToken(id_token);
  } catch (error) {
    throw Object.assign(new Error('That Google sign-in could not be verified.'), { code: 'GOOGLE_TOKEN_INVALID' });
  }
  const sub = String(decoded.sub || decoded.uid || '').trim();
  const email = String(decoded.email || '').trim().toLowerCase();
  const name = String(decoded.name || '').trim().slice(0, 80);
  const emailVerified = decoded.email_verified === true;
  if (!sub || !EMAIL_RE.test(email)) {
    throw Object.assign(new Error('A Google profile with a verified email is required.'), { code: 'GOOGLE_PROFILE_INVALID' });
  }

  const bySub = await pool.query(
    `select * from site_customers where business_id = $1 and google_sub = $2`,
    [businessId, sub]
  );

  let customer = bySub.rows[0] || null;
  if (customer) {
    const updated = await pool.query(
      `update site_customers
       set name = coalesce($2, name), email = $3,
           email_verified_at = coalesce(email_verified_at, $4), updated_at = now()
       where id = $1 returning *`,
      [customer.id, name || null, email, emailVerified ? new Date() : null]
    );
    customer = updated.rows[0];
  } else {
    const byEmail = await pool.query(
      `select * from site_customers where business_id = $1 and lower(email) = $2`,
      [businessId, email]
    );
    if (byEmail.rows[0]) {
      const linked = await pool.query(
        `update site_customers
         set google_sub = $2, name = coalesce($3, name),
             email_verified_at = coalesce(email_verified_at, $4), updated_at = now()
         where id = $1 returning *`,
        [byEmail.rows[0].id, sub, name || null, emailVerified ? new Date() : null]
      );
      customer = linked.rows[0];
    } else {
      const created = await pool.query(
        `insert into site_customers (business_id, email, name, google_sub, email_verified_at)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [businessId, email, name, sub, emailVerified ? new Date() : null]
      );
      customer = created.rows[0];
    }
  }

  const session = await createSession(customer.id);
  return { customer, session };
}

async function sendPhoneCode(customerId, rawPhone) {
  const phone = formatSriLankanPhone(String(rawPhone || '').trim());
  const { rows: hourCount } = await pool.query(
    `select count(*)::int as n from site_customer_otps
     where site_customer_id = $1 and channel = 'phone' and created_at > now() - interval '1 hour'`,
    [customerId]
  );
  if (hourCount[0].n >= HOURLY_SEND_LIMIT) {
    throw Object.assign(new Error('Too many codes sent. Try again in an hour.'), { code: 'OTP_RATE_LIMITED' });
  }
  const recent = await findActiveOtp(customerId, 'phone', phone);
  if (recent && new Date(recent.created_at) > new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000)) {
    throw Object.assign(new Error(`Wait at least ${RESEND_WINDOW_SECONDS} seconds before requesting a new code.`), { code: 'OTP_RESEND_TOO_SOON' });
  }
  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const brand = await getBrandName();
  await sendSms({
    to: phone,
    message: `${brand}: your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. Do not share it.`
  });
  await pool.query(
    `insert into site_customer_otps (site_customer_id, channel, target, code_hash, salt, expires_at)
     values ($1, 'phone', $2, $3, $4, now() + interval '${CODE_TTL_MINUTES} minutes')`,
    [customerId, phone, hashCode(code, salt), salt]
  );
  return { phone };
}

async function confirmPhoneCode(customerId, rawPhone, code) {
  const phone = formatSriLankanPhone(String(rawPhone || '').trim());
  await verifyOtp(customerId, 'phone', phone, String(code || '').trim());
  await pool.query(
    `update site_customers set phone = $2, phone_verified_at = now(), updated_at = now() where id = $1`,
    [customerId, phone]
  );
}

async function sendEmailCode(customerId, rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw Object.assign(new Error('Enter a valid email address.'), { code: 'EMAIL_INVALID' });
  }
  const { rows: hourCount } = await pool.query(
    `select count(*)::int as n from site_customer_otps
     where site_customer_id = $1 and channel = 'email' and created_at > now() - interval '1 hour'`,
    [customerId]
  );
  if (hourCount[0].n >= HOURLY_SEND_LIMIT) {
    throw Object.assign(new Error('Too many codes sent. Try again in an hour.'), { code: 'OTP_RATE_LIMITED' });
  }
  const recent = await findActiveOtp(customerId, 'email', email);
  if (recent && new Date(recent.created_at) > new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000)) {
    throw Object.assign(new Error(`Wait at least ${RESEND_WINDOW_SECONDS} seconds before requesting a new code.`), { code: 'OTP_RESEND_TOO_SOON' });
  }
  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const brand = await getBrandName();
  const { text, html } = buildVerificationCodeHtml(code, brand, CODE_TTL_MINUTES);
  await sendEmail({
    to: email,
    subject: `${brand} — verify your email`,
    html,
    text
  });
  await pool.query(
    `insert into site_customer_otps (site_customer_id, channel, target, code_hash, salt, expires_at)
     values ($1, 'email', $2, $3, $4, now() + interval '${CODE_TTL_MINUTES} minutes')`,
    [customerId, email, hashCode(code, salt), salt]
  );
  return { email };
}

async function confirmEmailCode(customerId, rawEmail, code) {
  const email = String(rawEmail || '').trim().toLowerCase();
  await verifyOtp(customerId, 'email', email, String(code || '').trim());
  await pool.query(
    `update site_customers set email = $2, email_verified_at = now(), updated_at = now() where id = $1`,
    [customerId, email]
  );
}

module.exports = {
  liveBusinessForHostname,
  register,
  login,
  googleUpsert,
  sendPhoneCode,
  confirmPhoneCode,
  sendEmailCode,
  confirmEmailCode,
  createSession,
  customerForToken,
  revokeToken,
  tokenHash,
  hashPassword,
  verifyPassword
};
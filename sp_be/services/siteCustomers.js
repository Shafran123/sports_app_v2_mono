// Site Customer auth (ADR-0030): per-Business identities with our own auth —
// email+password (scrypt), bearer-token sessions, per-Business phone/email
// OTP verification, and Google sign-in mapped to a per-Business profile.
// Firebase stays for platform accounts (Player, Venue Owner, Admin) — this
// service never touches the `users` table.

const crypto = require('node:crypto');
const pool = require('../db');
const siteDomains = require('./siteDomains');
const siteChallenges = require('./siteChallenges');
const siteTotp = require('./siteTotp');
const { generateCode, hashCode, timingSafeEqualHex, CODE_TTL_MINUTES, MAX_ATTEMPTS, HOURLY_SEND_LIMIT } = require('../utils/otpCode');
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

const RESEND_WINDOW_SECONDS = 60;

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
    `select sc.*, b.name as business_name, b.require_2fa as totp_required
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

// Shared register validation: email shape, name, password strength, and the
// per-Business uniqueness of the email. Used by the direct register and by
// the Anti-bot Check escalation (a low-score registration must fail on the
// same rules BEFORE a challenge is issued, so bots get identical answers).
async function validateRegisterInput(businessId, { name, email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim().slice(0, 80);
  if (!EMAIL_RE.test(cleanEmail)) {
    throw Object.assign(new Error('Enter a valid email address.'), { code: 'EMAIL_INVALID' });
  }
  if (!password || String(password).length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters.'), { code: 'PASSWORD_WEAK' });
  }
  const { rows } = await pool.query(
    `select 1 from site_customers where business_id = $1 and lower(email) = $2`,
    [businessId, cleanEmail]
  );
  if (rows.length > 0) {
    throw Object.assign(new Error('An account with this email already exists at this site.'), { code: 'SITE_CUSTOMER_EXISTS' });
  }
  return { email: cleanEmail, name: cleanName };
}

// Insert a Site Customer row; a duplicate email at the Business surfaces as
// SITE_CUSTOMER_EXISTS. Shared by the direct register and the Anti-bot Check
// register-challenge completion.
async function insertCustomer(businessId, email, name, passwordHash) {
  return pool.query(
    `insert into site_customers (business_id, email, name, password_hash)
     values ($1, $2, $3, $4)
     returning *`,
    [businessId, email, name, passwordHash]
  ).catch((error) => {
    if (error.code === '23505') {
      throw Object.assign(new Error('An account with this email already exists at this site.'), { code: 'SITE_CUSTOMER_EXISTS' });
    }
    throw error;
  }).then((result) => result.rows[0]);
}

// Register an email+password Site Customer inside a live site's Business.
// Same email at another Business creates a fully independent account.
async function register({ site_hostname, name, email, password }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  const clean = await validateRegisterInput(businessId, { name, email, password });
  const customer = await insertCustomer(businessId, clean.email, clean.name, hashPassword(String(password)));
  const session = await createSession(customer.id);
  return { customer, session };
}

// Verify an email+password against a known Business. Throws
// SITE_CUSTOMER_BAD_CREDENTIALS without revealing which half was wrong.
async function authenticateCredentials(businessId, { email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const { rows } = await pool.query(
    `select sc.*, b.require_2fa as totp_required
     from site_customers sc join businesses b on b.id = sc.business_id
     where sc.business_id = $1 and lower(sc.email) = $2`,
    [businessId, cleanEmail]
  );
  const customer = rows[0] || null;
  if (!customer || !verifyPassword(String(password || ''), customer.password_hash)) {
    throw Object.assign(new Error('Incorrect email or password.'), { code: 'SITE_CUSTOMER_BAD_CREDENTIALS' });
  }
  return customer;
}

// ---- Second Factor (tickets 07-08) ----

// Every sign-in gate — email+password and Google alike — routes through this:
// a Business that requires the factor refuses the sign-in of a customer who
// has not enabled it (SECOND_FACTOR_REQUIRED), and an enrolled customer must
// complete a TOTP/backup-code challenge BEFORE any session is issued. The
// challenge is bound to the customer server-side; the client never supplies
// the identity. `customer.totp_required` arrives on the caller's join.
async function assertSecondFactorReady(businessId, customer) {
  const required = Boolean(customer.totp_required);
  if (required && !customer.totp_enabled_at) {
    throw Object.assign(
      new Error('This venue requires two-factor authentication. Enable it in your profile to sign in.'),
      { code: 'SECOND_FACTOR_REQUIRED' }
    );
  }
  if (customer.totp_enabled_at) {
    return siteChallenges.createChallenge({
      businessId,
      purpose: 'totp',
      email: customer.email,
      siteCustomerId: customer.id
    });
  }
  return null;
}

async function login({ site_hostname, email, password }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  const customer = await authenticateCredentials(businessId, { email, password });
  const challenge = await assertSecondFactorReady(businessId, customer);
  if (challenge) return { challenge };
  const session = await createSession(customer.id);
  return { customer, session };
}

// ---- Anti-bot Check escalation (ticket 05) ----

// A low-score sign-in never issues a session: credentials are still checked
// (a bot without the password gets the identical 401), then the human must
// prove control of the inbox before the session is issued. The Second Factor
// still applies on this path — an enrolled customer proves the human with the
// factor itself (a TOTP challenge, no email needed), and a Business that
// requires the factor still refuses an unenrolled customer (ticket 07).
async function loginChallenge({ site_hostname, email, password }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  const customer = await authenticateCredentials(businessId, { email, password });
  const factor = await assertSecondFactorReady(businessId, customer);
  if (factor) return factor;
  const challenge = await siteChallenges.createChallenge({
    businessId,
    purpose: 'login',
    email: customer.email
  });
  return challenge;
}

// A low-score registration escalates on the same validation rules as a normal
// register — email shape, password strength, uniqueness — and stashes the
// scrypt hash so the confirm step creates the account without trusting the
// client again.
async function registerChallenge({ site_hostname, name, email, password }) {
  const { businessId } = await liveBusinessForHostname(site_hostname);
  const clean = await validateRegisterInput(businessId, { name, email, password });
  const challenge = await siteChallenges.createChallenge({
    businessId,
    purpose: 'register',
    email: clean.email,
    name: clean.name,
    passwordHash: hashPassword(String(password))
  });
  return challenge;
}

// Consume a challenge and finish the sign-in it guards: a login challenge
// issues a session for the customer the challenge was bound to; a register
// challenge creates the account with the stored hash (guarded against the
// email being taken between escalation and confirm); a TOTP challenge has
// already been verified (code or backup code) inside confirmChallenge and
// just issues the session — a wrong or exhausted code never gets here.
async function completeChallenge({ challenge_id, code }) {
  const challenge = await siteChallenges.confirmChallenge(challenge_id, String(code || '').trim());
  if (challenge.purpose === 'totp') {
    const { rows } = await pool.query(
      `select * from site_customers where id = $1`,
      [challenge.site_customer_id]
    );
    const customer = rows[0] || null;
    if (!customer || !customer.totp_enabled_at) {
      throw Object.assign(new Error('Two-factor authentication is no longer active. Sign in again.'), { code: 'TOTP_NOT_ENABLED' });
    }
    const session = await createSession(customer.id);
    return { customer, session };
  }
  if (challenge.purpose === 'login') {
    const { rows } = await pool.query(
      `select sc.*, b.require_2fa as totp_required
       from site_customers sc join businesses b on b.id = sc.business_id
       where sc.business_id = $1 and lower(sc.email) = $2`,
      [challenge.business_id, String(challenge.email).toLowerCase()]
    );
    if (!rows[0]) {
      throw Object.assign(new Error('Incorrect email or password.'), { code: 'SITE_CUSTOMER_BAD_CREDENTIALS' });
    }
    // The factor state can change between escalation and confirm (the
    // customer enrolled in the meantime, or the Business turned the toggle
    // on). Never let this email-OTP path mint a session that skips it.
    const customer = rows[0];
    if (customer.totp_required && !customer.totp_enabled_at) {
      throw Object.assign(
        new Error('This venue requires two-factor authentication. Enable it in your profile to sign in.'),
        { code: 'SECOND_FACTOR_REQUIRED' }
      );
    }
    if (customer.totp_enabled_at) {
      throw Object.assign(
        new Error('Finish signing in again to complete your second factor.'),
        { code: 'SECOND_FACTOR_PENDING' }
      );
    }
    const session = await createSession(customer.id);
    return { customer, session };
  }
  const customer = await insertCustomer(challenge.business_id, challenge.email, challenge.name || null, challenge.password_hash);
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

  // Re-read with the Business join so every consumer sees the Second Factor
  // state (totp_enabled_at + the Business's require_2fa as totp_required).
  const { rows: fresh } = await pool.query(
    `select sc.*, b.require_2fa as totp_required
     from site_customers sc join businesses b on b.id = sc.business_id
     where sc.id = $1`,
    [customer.id]
  );
  customer = fresh[0] || customer;

  const challenge = await assertSecondFactorReady(businessId, customer);
  if (challenge) return { challenge };
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
  loginChallenge,
  registerChallenge,
  completeChallenge,
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
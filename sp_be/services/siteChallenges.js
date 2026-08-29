// Email-OTP escalation challenges for the Anti-bot Check (ticket 05): a
// Dedicated Site sign-in/registration with a low reCAPTCHA score must prove
// control of the inbox before a session is issued. Challenges are created
// server-side with the intended identity bound to the Business, and consumed
// exactly once. Same hardening as the site-customer OTPs: HMAC-hashed codes,
// per-challenge salt, expiry, an attempts cap, and a per-email hourly send
// limit so escalation can never be abused as an email-bombing vector.

const crypto = require('node:crypto');
const pool = require('../db');
const siteTotp = require('./siteTotp');
const { sendEmail, buildVerificationCodeHtml } = require('../utils/emailService');
const { getBrandName } = require('../utils/featureFlags');
const { generateCode, hashCode, timingSafeEqualHex, CODE_TTL_MINUTES, MAX_ATTEMPTS, HOURLY_SEND_LIMIT } = require('../utils/otpCode');

// Issue a challenge: store the hashed code + intended identity, email the
// code. Throws OTP_RATE_LIMITED when the address has had too many challenges
// in the last hour. Returns the public challenge row (never the hash/salt).
async function createChallenge({ businessId, purpose, email, name = null, passwordHash = null, siteCustomerId = null }) {
  const { rows: hourCount } = await pool.query(
    `select count(*)::int as n from site_auth_challenges
     where business_id = $1 and email = $2 and created_at > now() - interval '1 hour'`,
    [businessId, email]
  );
  if (hourCount[0].n >= HOURLY_SEND_LIMIT) {
    throw Object.assign(new Error('Too many verification codes sent. Try again in an hour.'), { code: 'OTP_RATE_LIMITED' });
  }
  const code = generateCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const { rows } = await pool.query(
    `insert into site_auth_challenges (business_id, purpose, email, name, password_hash, site_customer_id, code_hash, salt, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '${CODE_TTL_MINUTES} minutes')
     returning id, purpose, email, expires_at, created_at`,
    [businessId, purpose, email, name, passwordHash, siteCustomerId, hashCode(code, salt), salt]
  );
  if (purpose === 'totp') {
    // A TOTP challenge has no emailed code — the visitor proves the factor
    // from their authenticator app (or a backup code) at confirm time.
    return rows[0];
  }
  const brand = await getBrandName();
  const { text, html } = buildVerificationCodeHtml(code, brand, CODE_TTL_MINUTES);
  await sendEmail({
    to: email,
    subject: `${brand} — verify your sign-in`,
    html,
    text
  });
  return rows[0];
}

// Consume a challenge with its code. Returns the challenge row (including the
// stored identity for the confirm step) or throws OTP_* — expired, too many
// attempts, invalid, or already consumed.
async function confirmChallenge(challengeId, code) {
  const { rows } = await pool.query(
    `select * from site_auth_challenges where id = $1`,
    [challengeId]
  );
  const row = rows[0] || null;
  if (!row || row.consumed_at) {
    throw Object.assign(new Error('This verification has already been used. Sign in again.'), { code: 'OTP_INVALID' });
  }
  if (new Date(row.expires_at) < new Date()) {
    throw Object.assign(new Error('This verification has expired. Sign in again.'), { code: 'OTP_EXPIRED' });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(new Error('Too many attempts. Sign in again to request a new code.'), { code: 'OTP_TOO_MANY_ATTEMPTS' });
  }
  await pool.query(
    `update site_auth_challenges set attempts = attempts + 1 where id = $1`,
    [row.id]
  );
  if (row.purpose === 'totp') {
    // A TOTP challenge is proven by the authenticator-app code or an unused
    // backup code, verified here against the bound customer's factor — a
    // wrong code never consumes the challenge, so the human can retry up to
    // the attempts cap. The customer identity comes from the row, never the
    // client.
    if (!row.site_customer_id) {
      throw Object.assign(new Error('This verification is missing its customer. Sign in again.'), { code: 'TOTP_INVALID' });
    }
    const { rows: customerRows } = await pool.query(
      `select totp_secret_enc, totp_enabled_at from site_customers where id = $1`,
      [row.site_customer_id]
    );
    const customer = customerRows[0] || null;
    const secret = customer && customer.totp_enabled_at ? siteTotp.decryptSecret(customer.totp_secret_enc) : null;
    const proven = Boolean(secret && siteTotp.verifyCode(secret, String(code))) ||
      (await siteTotp.redeemBackupCode(row.site_customer_id, code));
    if (!proven) {
      throw Object.assign(new Error('That code is not correct.'), { code: 'TOTP_INVALID' });
    }
    const consumed = await pool.query(
      `update site_auth_challenges set consumed_at = now() where id = $1 and consumed_at is null returning *`,
      [row.id]
    );
    if (!consumed.rows[0]) {
      throw Object.assign(new Error('This verification has already been used. Sign in again.'), { code: 'TOTP_INVALID' });
    }
    return consumed.rows[0];
  }
  if (!timingSafeEqualHex(hashCode(String(code), row.salt), row.code_hash)) {
    throw Object.assign(new Error('That code is not correct.'), { code: 'OTP_INVALID' });
  }
  const consumed = await pool.query(
    `update site_auth_challenges set consumed_at = now() where id = $1 returning *`,
    [row.id]
  );
  return consumed.rows[0];
}

module.exports = { createChallenge, confirmChallenge };
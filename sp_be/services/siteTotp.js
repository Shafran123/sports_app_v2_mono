// Second Factor for Site Customers (tickets 07-09): our own TOTP — no
// Firebase, no third-party provider. The authenticator-app secret is
// generated server-side, encrypted at rest with a server key (AES-256-GCM,
// key derived from TOTP_ENCRYPTION_KEY, falling back to the OTP secret), and
// verified server-side at sign-in. Ten single-use backup codes are stored
// HMAC-hashed with per-code salts (same hardening as the OTP channels) and
// each is consumed by exactly one use. Recovery: the Venue Owner (own
// Business) or an Admin can reset a customer's factor, which also revokes
// all of that customer's active sessions.

const crypto = require('node:crypto');
const pool = require('../db');
const { hashCode, timingSafeEqualHex } = require('../utils/otpCode');

const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ---- Secret generation + encryption at rest ----

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function generateSecret() {
  // 20 random bytes -> 32-char base32 secret (160 bits, the TOTP RFC size).
  const bytes = crypto.randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out.slice(0, 32);
}

function encryptionKey() {
  const raw = process.env.TOTP_ENCRYPTION_KEY || process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET || 'totp-dev-key';
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptSecret(stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, encHex] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ---- TOTP codes (RFC 6238, HMAC-SHA1, 6 digits, 30s period) ----

// Authenticator apps treat the secret as base32-encoded bytes — the HMAC key
// is the DECODED secret, never the base32 characters themselves. Without this
// the server and the app compute different codes and every correct code fails.
function base32Decode(secret) {
  const cleaned = String(secret || '').toUpperCase().replace(/=+$/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of cleaned) {
    const index = BASE32_ALPHABET.indexOf(ch);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpCode(secret, timeStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS)) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(timeStep));
  const key = base32Decode(secret);
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
  return code;
}

function verifyCode(secret, code) {
  const clean = String(code || '').trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const nowStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let step = nowStep - TOTP_WINDOW_STEPS; step <= nowStep + TOTP_WINDOW_STEPS; step += 1) {
    if (crypto.timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(clean))) return true;
  }
  return false;
}

// ---- Backup codes ----

function generateBackupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let raw = '';
  for (let i = 0; i < 8; i += 1) raw += alphabet[crypto.randomInt(0, alphabet.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function normalizeBackupCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

async function clearBackupCodes(customerId, client = pool) {
  await client.query(`delete from site_customer_backup_codes where site_customer_id = $1`, [customerId]);
}

// Replace the customer's backup codes with a fresh set of ten; returns the
// plaintext codes exactly once (the caller shows them once and they are
// never retrievable again).
async function regenerateBackupCodes(customerId, client = pool) {
  await clearBackupCodes(customerId, client);
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCode());
  for (const code of codes) {
    const salt = crypto.randomBytes(16).toString('hex');
    await client.query(
      `insert into site_customer_backup_codes (site_customer_id, code_hash, salt)
       values ($1, $2, $3)`,
      [customerId, hashCode(code, salt), salt]
    );
  }
  return codes;
}

// Redeem a backup code: exactly one use each, then it is dead.
async function redeemBackupCode(customerId, code) {
  const clean = normalizeBackupCode(code);
  if (!BACKUP_CODE_RE.test(clean)) return false;
  const { rows } = await pool.query(
    `select id, code_hash, salt from site_customer_backup_codes
     where site_customer_id = $1 and used_at is null`,
    [customerId]
  );
  for (const row of rows) {
    if (timingSafeEqualHex(hashCode(clean, row.salt), row.code_hash)) {
      const claimed = await pool.query(
        `update site_customer_backup_codes set used_at = now()
         where id = $1 and used_at is null returning 1`,
        [row.id]
      );
      return claimed.rows.length > 0;
    }
  }
  return false;
}

async function backupCodesRemaining(customerId) {
  const { rows } = await pool.query(
    `select count(*)::int as n from site_customer_backup_codes
     where site_customer_id = $1 and used_at is null`,
    [customerId]
  );
  return rows[0].n;
}

// ---- Factor lifecycle ----

// Begin enrollment: stash the encrypted secret on the customer (not yet
// enabled), return what the authenticator app needs. The plaintext secret is
// returned exactly once, here.
async function startEnrollment(customerId, businessName, client = pool) {
  const { rows } = await client.query(
    `select email, totp_enabled_at from site_customers where id = $1`,
    [customerId]
  );
  const customer = rows[0];
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { code: 'SITE_CUSTOMER_NOT_FOUND' });
  }
  if (customer.totp_enabled_at) {
    throw Object.assign(new Error('Two-factor authentication is already enabled.'), { code: 'TOTP_ALREADY_ENABLED' });
  }
  const secret = generateSecret();
  await client.query(
    `update site_customers set totp_secret_enc = $2, updated_at = now() where id = $1`,
    [customerId, encryptSecret(secret)]
  );
  const issuer = String(businessName || 'MySlot.LK').slice(0, 64);
  const label = `${issuer}:${customer.email}`;
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=${TOTP_PERIOD_SECONDS}`;
  return { secret, otpauth_url: otpauthUrl };
}

// Finish enrollment: prove control of the app by verifying a live code
// against the pending secret, then enable the factor and mint the ten backup
// codes (returned once).
async function confirmEnrollment(customerId, code) {
  const { rows } = await pool.query(
    `select totp_secret_enc, totp_enabled_at from site_customers where id = $1`,
    [customerId]
  );
  const customer = rows[0];
  if (!customer || !customer.totp_secret_enc) {
    throw Object.assign(new Error('Start two-factor enrollment first.'), { code: 'TOTP_NOT_STARTED' });
  }
  if (customer.totp_enabled_at) {
    throw Object.assign(new Error('Two-factor authentication is already enabled.'), { code: 'TOTP_ALREADY_ENABLED' });
  }
  const secret = decryptSecret(customer.totp_secret_enc);
  if (!secret || !verifyCode(secret, code)) {
    throw Object.assign(new Error('That code is not correct.'), { code: 'TOTP_INVALID' });
  }
  await pool.query(
    `update site_customers set totp_enabled_at = now(), updated_at = now() where id = $1`,
    [customerId]
  );
  return regenerateBackupCodes(customerId);
}

// Disable the factor. The customer must prove control with a current TOTP
// code or a backup code. A Business that requires the factor never allows
// disabling — that would strand the customer at the next sign-in.
async function disableFactor(customerId, code) {
  const { rows } = await pool.query(
    `select sc.totp_secret_enc, sc.totp_enabled_at, b.require_2fa
     from site_customers sc join businesses b on b.id = sc.business_id
     where sc.id = $1`,
    [customerId]
  );
  const customer = rows[0];
  if (!customer || !customer.totp_enabled_at) {
    throw Object.assign(new Error('Two-factor authentication is not enabled.'), { code: 'TOTP_NOT_ENABLED' });
  }
  if (customer.require_2fa) {
    throw Object.assign(new Error('This venue requires two-factor authentication — it cannot be disabled here.'), { code: 'SECOND_FACTOR_REQUIRED' });
  }
  const secret = decryptSecret(customer.totp_secret_enc);
  const proven = (secret && verifyCode(secret, code)) || (await redeemBackupCode(customerId, code));
  if (!proven) {
    throw Object.assign(new Error('Enter a current code from your authenticator app, or an unused backup code.'), { code: 'TOTP_INVALID' });
  }
  await pool.query(
    `update site_customers set totp_secret_enc = null, totp_enabled_at = null, updated_at = now()
     where id = $1`,
    [customerId]
  );
  await clearBackupCodes(customerId);
}

// Recovery: clear the factor and every backup code, and revoke ALL of the
// customer's active sessions (the old factor and old sessions die together).
// Atomic: either all three land or none. Used by the Venue Owner for their
// own Business's customers and by an Admin as backstop.
async function resetFactor(customerId) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update site_customers set totp_secret_enc = null, totp_enabled_at = null, updated_at = now()
       where id = $1`,
      [customerId]
    );
    await clearBackupCodes(customerId, client);
    await client.query(`delete from site_customer_sessions where site_customer_id = $1`, [customerId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  generateSecret,
  encryptSecret,
  decryptSecret,
  totpCode,
  verifyCode,
  generateBackupCode,
  normalizeBackupCode,
  clearBackupCodes,
  regenerateBackupCodes,
  redeemBackupCode,
  backupCodesRemaining,
  startEnrollment,
  confirmEnrollment,
  disableFactor,
  resetFactor
};
// Shared OTP code helpers (phone/email verification + the Anti-bot Check's
// email-OTP escalation): one implementation of code generation, HMAC hashing
// and constant-time comparison, with the shared expiry/attempts/send-limit
// constants. Hardening here applies to every OTP channel at once.

const crypto = require('node:crypto');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const HOURLY_SEND_LIMIT = 5;

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

module.exports = { generateCode, hashCode, timingSafeEqualHex, CODE_TTL_MINUTES, MAX_ATTEMPTS, HOURLY_SEND_LIMIT };
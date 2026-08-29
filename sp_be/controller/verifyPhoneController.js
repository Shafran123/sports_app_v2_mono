const crypto = require('node:crypto');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { sendSms, formatSriLankanPhone } = require('../utils/smsService');
const { recordOutbound } = require('../utils/notificationCatalog');
const { getBrandName } = require('../utils/featureFlags');
const { generateCode, hashCode, timingSafeEqualHex, CODE_TTL_MINUTES, MAX_ATTEMPTS, HOURLY_SEND_LIMIT } = require('../utils/otpCode');

const RESEND_WINDOW_SECONDS = 60;

// Keyed HMAC (not plain sha256) so a leaked DB cannot be brute-forced with a
// fast hash — the 10^6 code space stays protected by an unknown server key.
// The key comes from OTP_HMAC_SECRET (required at boot outside test; tests
// run with JWT_SECRET set).
function hmacKey() {
  return process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET;
}

exports.sendVerificationCode = async (req, res) => {
  try {
    const rawPhone = String(req.body.phone || '').trim();
    if (!rawPhone) {
      return fail(res, 400, 'PHONE_INVALID', 'Enter a phone number.');
    }
    const phone = formatSriLankanPhone(rawPhone);

    const { rows: hourCount } = await pool.query(
      `select count(*)::int as n from verification_otps
       where phone = $1 and created_at > now() - interval '1 hour'`,
      [phone]
    );
    const { rows: userHourCount } = await pool.query(
      `select count(*)::int as n from verification_otps
       where user_id = $1 and created_at > now() - interval '1 hour'`,
      [req.user.id]
    );
    if (hourCount[0].n >= HOURLY_SEND_LIMIT || userHourCount[0].n >= HOURLY_SEND_LIMIT) {
      return fail(res, 429, 'OTP_RATE_LIMITED', 'Too many codes sent. Try again in an hour.');
    }

    const { rows: recent } = await pool.query(
      `select 1 from verification_otps
       where user_id = $1 and phone = $2 and created_at > now() - interval '60 seconds'
       limit 1`,
      [req.user.id, phone]
    );
    if (recent.length > 0) {
      return fail(res, 429, 'OTP_RESEND_TOO_SOON', `Wait at least ${RESEND_WINDOW_SECONDS} seconds before requesting a new code.`);
    }

    const code = generateCode();
    const brand = await getBrandName();

    // Send first; only record the code once the SMS actually went out. A
    // failed send must not burn the resend window, invalidate a still-valid
    // code, or lie to the client with a 200.
    const result = await sendSms({
      to: phone,
      message: `${brand}: your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. Do not share it.`
    });
    await recordOutbound({
      channel: 'sms',
      to: phone,
      key: 'otp.code',
      status: result.success ? 'sent' : ['SMS disabled', 'SMS not configured'].includes(result.error) ? 'skipped' : 'failed',
      error: result.success ? null : result.error,
      providerRef: result.id || null
    });
    if (!result.success) {
      logger.error(`Verification SMS failed for ${phone}: ${result.error}`);
      return fail(res, 502, 'SMS_SEND_FAILED', result.error || 'Failed to send the SMS. Try again in a moment.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `delete from verification_otps where user_id = $1 and phone = $2`,
      [req.user.id, phone]
    );
    await pool.query(
      `insert into verification_otps (user_id, phone, code_hash, salt, expires_at)
       values ($1, $2, $3, $4, now() + interval '10 minutes')`,
      [req.user.id, phone, hashCode(code, salt), salt]
    );

    ok(res, 200, { sent: true, resend_after_seconds: RESEND_WINDOW_SECONDS });
  } catch (error) {
    logger.error(`Error sending verification code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.confirmVerification = async (req, res) => {
  try {
    const rawPhone = String(req.body.phone || '').trim();
    const code = String(req.body.code || '').trim();
    if (!rawPhone || !code) {
      return fail(res, 400, 'OTP_INVALID', 'Enter the code from the SMS.');
    }
    const phone = formatSriLankanPhone(rawPhone);

    const { rows } = await pool.query(
      `select id, code_hash, salt, expires_at, attempts from verification_otps
       where user_id = $1 and phone = $2
       order by created_at desc limit 1`,
      [req.user.id, phone]
    );
    if (rows.length === 0) {
      return fail(res, 400, 'OTP_INVALID', 'No active code for this number. Request a new one.');
    }
    const otp = rows[0];

    if (otp.expires_at <= new Date()) {
      return fail(res, 400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return fail(res, 400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
    }

    if (!timingSafeEqualHex(otp.code_hash, hashCode(code, otp.salt))) {
      const nextAttempts = otp.attempts + 1;
      await pool.query(
        `update verification_otps set attempts = $1 where id = $2`,
        [nextAttempts, otp.id]
      );
      if (nextAttempts >= MAX_ATTEMPTS) {
        return fail(res, 400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
      }
      return fail(res, 400, 'OTP_INVALID', 'That code is not correct.');
    }

    await pool.query('begin');
    try {
      await pool.query(
        `update users set phone = $1, phone_verified_at = now(), updated_at = now() where id = $2`,
        [phone, req.user.id]
      );
      await pool.query(
        `delete from verification_otps where user_id = $1 and phone = $2`,
        [req.user.id, phone]
      );
      await pool.query('commit');
    } catch (error) {
      await pool.query('rollback').catch(() => {});
      throw error;
    }

    const { rows: userRows } = await pool.query(
      `select * from users where id = $1`,
      [req.user.id]
    );
    ok(res, 200, userRows[0]);
  } catch (error) {
    logger.error(`Error confirming verification code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};
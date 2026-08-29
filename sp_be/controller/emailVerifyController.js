// Verified Email (ticket 01): an email OTP challenge mirroring the phone
// flow — same HMAC'd 6-digit code, same attempts/resend/rate-limit guards,
// delivered by email instead of SMS. Confirming with a new address swaps the
// account email AND proves it in the same step, so the verified marker never
// describes an address that didn't pass a challenge.

const crypto = require('node:crypto');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');
const { recordOutbound } = require('../utils/notificationCatalog');
const { getBrandName } = require('../utils/featureFlags');
const { generateCode, hashCode, timingSafeEqualHex, CODE_TTL_MINUTES, MAX_ATTEMPTS, HOURLY_SEND_LIMIT } = require('../utils/otpCode');

const RESEND_WINDOW_SECONDS = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hmacKey() {
  return process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET;
}

async function findActiveOtp(userId, email) {
  const { rows } = await pool.query(
    `select id, code_hash, salt, expires_at, attempts from verification_email_otps
     where user_id = $1 and email = $2
     order by created_at desc limit 1`,
    [userId, email]
  );
  return rows[0] || null;
}

exports.sendVerificationCode = async (req, res) => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(rawEmail)) {
      return fail(res, 400, 'EMAIL_INVALID', 'Enter a valid email address.');
    }

    const { rows: userHourCount } = await pool.query(
      `select count(*)::int as n from verification_email_otps
       where user_id = $1 and created_at > now() - interval '1 hour'`,
      [req.user.id]
    );
    const { rows: addressHourCount } = await pool.query(
      `select count(*)::int as n from verification_email_otps
       where email = $1 and created_at > now() - interval '1 hour'`,
      [rawEmail]
    );
    if (userHourCount[0].n >= HOURLY_SEND_LIMIT || addressHourCount[0].n >= HOURLY_SEND_LIMIT) {
      return fail(res, 429, 'OTP_RATE_LIMITED', 'Too many codes sent. Try again in an hour.');
    }

    const { rows: recent } = await pool.query(
      `select 1 from verification_email_otps
       where user_id = $1 and email = $2 and created_at > now() - interval '60 seconds'
       limit 1`,
      [req.user.id, rawEmail]
    );
    if (recent.length > 0) {
      return fail(res, 429, 'OTP_RESEND_TOO_SOON', `Wait at least ${RESEND_WINDOW_SECONDS} seconds before requesting a new code.`);
    }

    const code = generateCode();
    const brand = await getBrandName();
    const { preheader, text, html } = require('../utils/emailTemplates').buildVerificationCodeHtml(
      code,
      brand,
      CODE_TTL_MINUTES
    );

    // Send first; only record the code once the email actually went out.
    const result = await sendEmail({
      to: rawEmail,
      subject: `Your ${brand} verification code`,
      html,
      text
    });
    await recordOutbound({
      channel: 'email',
      to: rawEmail,
      key: 'otp.code',
      status: result.success ? 'sent' : result.error === 'Email not configured' ? 'skipped' : 'failed',
      error: result.success ? null : result.error,
      providerRef: result.id || null
    });
    if (!result.success) {
      logger.error(`Verification email failed for ${rawEmail}: ${result.error}`);
      return fail(res, 502, 'EMAIL_SEND_FAILED', result.error || 'Failed to send the email. Try again in a moment.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `delete from verification_email_otps where user_id = $1 and email = $2`,
      [req.user.id, rawEmail]
    );
    await pool.query(
      `insert into verification_email_otps (user_id, email, code_hash, salt, expires_at)
       values ($1, $2, $3, $4, now() + interval '10 minutes')`,
      [req.user.id, rawEmail, hashCode(code, salt), salt]
    );

    ok(res, 200, { sent: true, resend_after_seconds: RESEND_WINDOW_SECONDS });
  } catch (error) {
    logger.error(`Error sending email verification code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.confirmVerification = async (req, res) => {
  try {
    const rawEmail = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    if (!EMAIL_RE.test(rawEmail) || !code) {
      return fail(res, 400, 'OTP_INVALID', 'Enter the code from the email.');
    }

    const otp = await findActiveOtp(req.user.id, rawEmail);
    if (!otp) {
      return fail(res, 400, 'OTP_INVALID', 'No active code for this address. Request a new one.');
    }
    if (otp.expires_at <= new Date()) {
      return fail(res, 400, 'OTP_EXPIRED', 'This code has expired. Request a new one.');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return fail(res, 400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
    }

    if (!timingSafeEqualHex(otp.code_hash, hashCode(code, otp.salt))) {
      const nextAttempts = otp.attempts + 1;
      await pool.query(
        `update verification_email_otps set attempts = $1 where id = $2`,
        [nextAttempts, otp.id]
      );
      if (nextAttempts >= MAX_ATTEMPTS) {
        return fail(res, 400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
      }
      return fail(res, 400, 'OTP_INVALID', 'That code is not correct.');
    }

    await pool.query('begin');
    try {
      // Atomic email swap + verify: the stored email and the verified marker
      // always describe the same address. Changing the email therefore
      // requires the new address to pass its own challenge.
      await pool.query(
        `update users set email = $1, email_verified_at = now(), updated_at = now() where id = $2`,
        [rawEmail, req.user.id]
      );
      await pool.query(
        `delete from verification_email_otps where user_id = $1 and email = $2`,
        [req.user.id, rawEmail]
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
    logger.error(`Error confirming email verification code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};
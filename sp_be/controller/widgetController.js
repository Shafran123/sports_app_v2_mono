// Public Booking Widget endpoints (ADR-0028). The widget lives in an iframe on
// a business's own website; these endpoints power the embed config fetch, the
// unified phone-OTP identity step, and the public QR image for SMS delivery.
//
// Scope (ADR-0028 amendment v1.5): the embed key now resolves a Widget
// Instance of a Business, not a venue. The config returns the business brand,
// the instance's defaults (default venue + venue-choice toggle), and the
// eligible venues (all approved venues of the business, Private included).
// The allowlist is per instance; origin enforcement is unchanged.
//
// Identity model: the widget verifies a phone with the same HMAC'd OTP scheme
// as the app; a phone that already belongs to a Player links to that account,
// a fresh phone is auto-created as a Player and phone-verified server-side.
// The client finishes the flow with a custom token sign-in, so the whole
// existing player machinery (QR, reminders, history) works unchanged.

const crypto = require('node:crypto');
const { SignJWT } = require('jose');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { sendSms, formatSriLankanPhone } = require('../utils/smsService');
const { recordOutbound } = require('../utils/notificationCatalog');
const { getBrandName } = require('../utils/featureFlags');
const { initFirebase } = require('../config/firebase');
const { isHostAllowed } = require('../utils/widget');
const { instanceByEmbedKey, effectiveScope } = require('../services/widgetInstances');
const { eligibleVenueRows } = require('../services/businesses');
const { buildVenueDetail } = require('../services/venuePayload');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_WINDOW_SECONDS = 60;
const HOURLY_SEND_LIMIT = 5;

function hmacKey() {
  return process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET;
}

function hashCode(code, salt) {
  return crypto.createHmac('sha256', hmacKey()).update(`${salt}${code}`).digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function timingSafeEqualHex(a, b) {
  const aBuf = Buffer.from(String(a || ''), 'hex');
  const bBuf = Buffer.from(String(b || ''), 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Widget rows are keyed by phone alone (user_id NULL): the account does not
// exist yet at send time. Rate limiting is per phone, not per user.
async function findActiveOtp(phone) {
  const { rows } = await pool.query(
    `select id, code_hash, salt, expires_at, attempts from verification_otps
     where user_id is null and phone = $1
     order by created_at desc limit 1`,
    [phone]
  );
  return rows[0] || null;
}

// Public config for the embed page: business + instance defaults + every
// eligible venue (with its courts, hours, brand-less public fields). The
// origin allowlist is per instance. Effective scope degrades server-side:
// a default venue that is no longer eligible reads as no-preselect and free
// choice, so a stale default never dead-ends the embed.
exports.getWidgetConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const instance = await instanceByEmbedKey(key);
    if (!instance) {
      return fail(res, 404, 'WIDGET_NOT_FOUND', 'This booking widget is not available');
    }

    const origin = String(req.query.origin || '').trim();
    if (origin && !isHostAllowed(instance, origin)) {
      return fail(res, 403, 'WIDGET_DOMAIN_NOT_ALLOWED', 'This widget is not authorized on this website');
    }

    const eligible = await eligibleVenueRows(instance.business_id);
    const scope = effectiveScope(instance, eligible.map((v) => v.id));
    const venues = (await Promise.all(eligible.map((v) => buildVenueDetail(v)))).map(
      // The business id is noise inside each venue when the response already
      // carries it at the top level; strip it per venue.
      ({ business_id, ...venue }) => venue
    );

    ok(res, 200, {
      business: {
        id: instance.business_id,
        name: instance.business_name,
        brand: instance.business_brand || {}
      },
      instance: {
        id: instance.id,
        name: instance.name,
        default_venue_id: scope.default_venue_id,
        allow_venue_choice: scope.allow_venue_choice
      },
      venues
    });
  } catch (error) {
    logger.error(`Error fetching widget config: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

exports.sendVerificationCode = async (req, res) => {
  try {
    // Keyed calls must resolve to an enabled instance (strict); keyless calls
    // (branded page) skip the gate — the OTP challenge is the boundary.
    const key = String(req.params.key || '').trim();
    if (key) {
      const instance = await instanceByEmbedKey(key);
      if (!instance) {
        return fail(res, 404, 'WIDGET_NOT_FOUND', 'This booking widget is not available');
      }
    }

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
    if (hourCount[0].n >= HOURLY_SEND_LIMIT) {
      return fail(res, 429, 'OTP_RATE_LIMITED', 'Too many codes sent. Try again in an hour.');
    }

    const { rows: recent } = await pool.query(
      `select 1 from verification_otps
       where phone = $1 and created_at > now() - interval '60 seconds'
       limit 1`,
      [phone]
    );
    if (recent.length > 0) {
      return fail(res, 429, 'OTP_RESEND_TOO_SOON', `Wait at least ${RESEND_WINDOW_SECONDS} seconds before requesting a new code.`);
    }

    const code = generateCode();
    const brand = await getBrandName();

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
      logger.error(`Widget verification SMS failed for ${phone}: ${result.error}`);
      return fail(res, 502, 'SMS_SEND_FAILED', result.error || 'Failed to send the SMS. Try again in a moment.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `delete from verification_otps where user_id is null and phone = $1`,
      [phone]
    );
    await pool.query(
      `insert into verification_otps (user_id, phone, code_hash, salt, expires_at)
       values (null, $1, $2, $3, now() + interval '10 minutes')`,
      [phone, hashCode(code, salt), salt]
    );

    ok(res, 200, { sent: true, resend_after_seconds: RESEND_WINDOW_SECONDS });
  } catch (error) {
    logger.error(`Error sending widget verification code: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// After a valid OTP: link the phone to its existing Player, or auto-create a
// Player + Firebase account (phone-verified) and hand back a token the widget
// completes a sign-in with. New-account welcome notifications fire via the
// normal signup path when the player later signs in, so none duplicate here.
exports.confirmVerification = async (req, res) => {
  const client = await pool.connect();
  try {
    const key = String(req.params.key || '').trim();
    if (key) {
      const instance = await instanceByEmbedKey(key);
      if (!instance) {
        return fail(res, 404, 'WIDGET_NOT_FOUND', 'This booking widget is not available');
      }
    }

    const rawPhone = String(req.body.phone || '').trim();
    const code = String(req.body.code || '').trim();
    if (!rawPhone || !code) {
      return fail(res, 400, 'OTP_INVALID', 'Enter the code from the SMS.');
    }
    const phone = formatSriLankanPhone(rawPhone);

    const otp = await findActiveOtp(phone);
    if (!otp) {
      return fail(res, 400, 'OTP_INVALID', 'No active code for this number. Request a new one.');
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
        `update verification_otps set attempts = $1 where id = $2`,
        [nextAttempts, otp.id]
      );
      if (nextAttempts >= MAX_ATTEMPTS) {
        return fail(res, 400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
      }
      return fail(res, 400, 'OTP_INVALID', 'That code is not correct.');
    }

    const { rows: existing } = await pool.query(
      `select * from users where phone = $1`,
      [phone]
    );

    let firebaseUid;
    let isNew = false;
    if (existing.length > 0) {
      firebaseUid = existing[0].firebase_uid;
    } else if (process.env.NODE_ENV === 'test') {
      // No real Firebase in tests: mint a synthetic uid — the test auth path
      // verifies { uid } JWTs against users.firebase_uid, which is exactly
      // the row created below, so the loop stays end-to-end without network.
      firebaseUid = `widget-test-${crypto.randomBytes(4).toString('hex')}`;
      isNew = true;
    } else {
      // Fresh phone → auto-create a Firebase account + Player row. The phone
      // doubles as the sign-in identifier (Phone Sign-in later) and the row
      // is created verified so the widget can book immediately.
      const admin = initFirebase();
      let created;
      try {
        created = await admin.auth().createUser({ phoneNumber: phone });
      } catch (firebaseError) {
        // A concurrent widget confirm may have already created the account
        // with this phone; link to it instead of failing the checkout.
        const { rows: raced } = await pool.query(
          `select * from users where phone = $1`,
          [phone]
        );
        if (raced.length > 0) {
          firebaseUid = raced[0].firebase_uid;
        } else {
          throw firebaseError;
        }
      }
      if (!firebaseUid) firebaseUid = created.uid;
      isNew = true;
    }

    await client.query('begin');
    try {
      if (isNew) {
        await client.query(
          `insert into users (firebase_uid, phone, phone_verified_at, role)
           values ($1, $2, now(), 'player')`,
          [firebaseUid, phone]
        );
      } else {
        // Existing player booked through the widget: the OTP is proof of the
        // phone, so an unverified phone becomes verified here.
        await client.query(
          `update users set phone = $1, phone_verified_at = coalesce(phone_verified_at, now()), updated_at = now()
           where id = $2`,
          [phone, existing[0].id]
        );
      }
      await client.query(
        `delete from verification_otps where user_id is null and phone = $1`,
        [phone]
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    }

    // Custom token the widget completes a sign-in with. Test/local runs have
    // no Firebase credential: sign the same { uid } JWT the test auth path
    // accepts so the flow is exercisable end to end.
    let token;
    if (process.env.NODE_ENV === 'test') {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret');
      token = await new SignJWT({ uid: firebaseUid })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .sign(secret);
    } else {
      token = await initFirebase().auth().createCustomToken(firebaseUid);
    }

    ok(res, 200, { token, is_new: isNew });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error confirming widget verification: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};
// Google reCAPTCHA v3 server-side verification (ticket 04, ADR-0042):
// one shared site key (env), no per-domain allowlisting — the hostname the
// token reports is validated against the request's own origin instead, and
// the action name against what each route expects. Fails closed: a missing,
// invalid, expired, reused, wrong-action or wrong-hostname token — and any
// siteverify outage — is a rejection, never a pass. The verified score is
// exposed so routes can decide escalate-vs-reject (site sign-in/register
// escalate to an email-OTP challenge; checkout and the owner-lead form
// reject outright).

const logger = require('../utils/logger');

// reCAPTCHA v3 score threshold (0.0–1.0). Above = human, below = bot.
function minScore(env = process.env) {
  const value = Number(env.RECAPTCHA_MIN_SCORE);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.5;
}

let warnedUnconfigured = false;

// The feature is off until the secret key is configured. This keeps dev and
// test environments (and the Booking Widget iframe, ADR-0042) working before
// a key is provisioned — once configured, every protected route fails closed.
// Outside test, an unconfigured deployment logs a one-time warning so the
// gate never goes silent by accident.
function isConfigured(env = process.env) {
  const configured = Boolean(env.RECAPTCHA_SECRET_KEY);
  if (!configured && !warnedUnconfigured && env.NODE_ENV !== 'test') {
    warnedUnconfigured = true;
    logger.warn('RECAPTCHA_SECRET_KEY is not set — the Anti-bot Check is OFF on every protected route.');
  }
  return configured;
}

// Normalize a hostname for comparison: lowercase, strip a trailing dot, peel
// a leading "www." and drop an explicit port (mirrors siteDomains — apex and
// www are one host, and dev hosts carry ports).
function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
}

function failure(code, message) {
  return { ok: false, code, message };
}

// Verify a token with Google's siteverify endpoint. Returns
// { ok: true, score } or { ok: false, code, message }.
// On any transport error the check fails closed (CAPTCHA_VERIFICATION_FAILED)
// so an attacker can never bypass the gate by DoS-ing siteverify.
async function verifyRecaptcha({ token, expectedAction, hostname, env = process.env }) {
  if (!isConfigured(env)) {
    return { ok: false, code: 'CAPTCHA_NOT_CONFIGURED', message: 'Anti-bot verification is not configured.' };
  }
  if (!token || typeof token !== 'string') {
    return failure('CAPTCHA_REQUIRED', 'This form requires an anti-bot check. Please refresh and try again.');
  }

  let body;
  try {
    const form = new URLSearchParams();
    form.append('secret', env.RECAPTCHA_SECRET_KEY);
    form.append('response', token);
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    if (!res.ok) {
      return failure('CAPTCHA_VERIFICATION_FAILED', 'The anti-bot check could not be verified. Please try again.');
    }
    body = await res.json();
  } catch (error) {
    return failure('CAPTCHA_VERIFICATION_FAILED', 'The anti-bot check could not be verified. Please try again.');
  }

  if (!body || body.success !== true) {
    const codes = Array.isArray(body?.['error-codes']) ? body['error-codes'] : [];
    // timeout-or-duplicate = the token was already consumed or expired —
    // the standard "token single-use/expiry respected" path.
    if (codes.includes('timeout-or-duplicate')) {
      return failure('CAPTCHA_TOKEN_INVALID', 'This anti-bot check has expired. Please try again.');
    }
    return failure('CAPTCHA_TOKEN_INVALID', 'The anti-bot check failed. Please try again.');
  }

  if (expectedAction && body.action !== expectedAction) {
    return failure('CAPTCHA_ACTION_MISMATCH', 'The anti-bot check does not match this form. Please try again.');
  }

  // Fail closed when either hostname is missing: a token with no minted
  // hostname (or a request with no origin) cannot be proven to belong to
  // this page, so it is treated as a mismatch.
  const tokenHostname = normalizeHostname(body.hostname);
  const requestHostname = normalizeHostname(hostname);
  if (!tokenHostname || !requestHostname || tokenHostname !== requestHostname) {
    return failure('CAPTCHA_HOSTNAME_MISMATCH', 'The anti-bot check does not match this page. Please try again.');
  }

  const score = Number(body.score);
  return { ok: true, score: Number.isFinite(score) ? score : 0 };
}

module.exports = { verifyRecaptcha, isConfigured, minScore, normalizeHostname };
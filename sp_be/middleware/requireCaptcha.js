// reCAPTCHA request middleware (ticket 04/05/06). Two flavours:
//
//   assessCaptcha({ action, siteOnly })  — validates the token (presence,
//     siteverify, action name, hostname vs the request's own origin) and
//     attaches `req.captcha = { score }` WITHOUT enforcing the score. Routes
//     that escalate (site login/register -> email-OTP) use this and decide on
//     the score themselves. Still fails closed on missing/invalid tokens.
//
//   requireCaptcha({ action, siteOnly, minScore }) — the same validation,
//     then rejects outright when the score is below the threshold. Routes
//     that hard-reject (checkout, owner-lead form) use this.
//
// Both skip when reCAPTCHA is unconfigured (no secret key in env), keeping
// dev/test and the Booking Widget iframe working (ADR-0042). With
// `siteOnly`, enforcement also only applies to requests arriving on a live
// Dedicated Site hostname — the widget's platform-origin iframe and the
// marketplace host never trigger it, so one shared key can never break them.

const recaptcha = require('../services/recaptcha');
const siteDomains = require('../services/siteDomains');
const { fail } = require('../utils/response');

// The request's own origin: the Origin header when the API is called
// cross-origin, else the Host header (the user app and landing proxy the API
// same-origin, so the host IS the surface the token was minted on).
function requestHostname(req) {
  const origin = req.get('origin');
  if (origin && /^https?:\/\//.test(origin)) {
    try {
      return new URL(origin).hostname;
    } catch {
      return null;
    }
  }
  return req.hostname || null;
}

function assessCaptcha({ action, siteOnly = false }) {
  return async (req, res, next) => {
    if (!recaptcha.isConfigured()) return next();

    const hostname = requestHostname(req);
    if (siteOnly) {
      const live = await siteDomains.liveByHostname(hostname).catch(() => null);
      // Not a live Dedicated Site host -> marketplace / widget iframe / dev:
      // the Anti-bot Check never runs there (ADR-0042).
      if (!live) return next();
    }

    const result = await recaptcha.verifyRecaptcha({ token: req.body?.captcha_token, expectedAction: action, hostname });
    if (!result.ok) {
      return fail(res, result.code === 'CAPTCHA_REQUIRED' ? 400 : 403, result.code, result.message);
    }
    req.captcha = { score: result.score };
    next();
  };
}

function requireCaptcha({ action, siteOnly = false, minScore = recaptcha.minScore() }) {
  const assess = assessCaptcha({ action, siteOnly });
  return async (req, res, next) => {
    // Run the shared assessment first; when it skipped (unconfigured /
    // off-site) req.captcha stays undefined and the gate passes.
    await assess(req, res, (err) => {
      if (err) return next(err);
      if (req.captcha && req.captcha.score < minScore) {
        return fail(res, 403, 'CAPTCHA_LOW_SCORE', 'We could not verify you are human. Please try again.');
      }
      next();
    });
  };
}

module.exports = { assessCaptcha, requireCaptcha };
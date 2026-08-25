const express = require('express');
const widgetController = require('../controller/widgetController');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Widget identity endpoints are public (no app session yet — the verify step
// CREATES the session). Kept gentle per IP; per-phone limits live in the DB.
// The key is optional on the identity endpoints: the branded page (per-venue
// by design) has no instance key, and the OTP challenge — not the key — is
// the security boundary there. Keyed calls still 404 on unknown/disabled keys.
const widgetLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 20 });

router.get('/:key/config', widgetController.getWidgetConfig);
router.post('/phone/send', widgetLimiter, widgetController.sendVerificationCode);
router.post('/phone/confirm', widgetLimiter, widgetController.confirmVerification);
router.post('/:key/phone/send', widgetLimiter, widgetController.sendVerificationCode);
router.post('/:key/phone/confirm', widgetLimiter, widgetController.confirmVerification);

module.exports = router;
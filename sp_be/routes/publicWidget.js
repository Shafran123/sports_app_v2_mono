const express = require('express');
const widgetController = require('../controller/widgetController');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Widget identity endpoints are public (no app session yet — the verify step
// CREATES the session). Kept gentle per IP; per-phone limits live in the DB.
const widgetLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 20 });

router.get('/:key/config', widgetController.getWidgetConfig);
router.post('/:key/phone/send', widgetLimiter, widgetController.sendVerificationCode);
router.post('/:key/phone/confirm', widgetLimiter, widgetController.confirmVerification);

module.exports = router;
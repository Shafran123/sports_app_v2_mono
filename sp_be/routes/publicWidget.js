const express = require('express');
const widgetController = require('../controller/widgetController');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Widget config is public (no app session yet — the sign-in that precedes
// booking uses the standard authenticated player endpoints, not these).
// Kept gentle per IP.
const widgetLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 20 });

router.get('/:key/config', widgetController.getWidgetConfig);

module.exports = router;
const express = require('express');
const paymentController = require('../controller/paymentController');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// The webhook is unauthenticated — bound per IP to keep webhook-flooding
// (a DB transaction each) from becoming a DoS vector.
const notifyLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 60 });

router.post('/payhere/notify', notifyLimiter, paymentController.handleNotify);

module.exports = router;

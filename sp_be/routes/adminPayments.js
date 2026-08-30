const express = require('express');
const paymentController = require('../controller/paymentController');
const paymentMethodsController = require('../controller/paymentMethodsController');

const router = express.Router();

// Admin read-only payment summary (ADR-0044, Q29/Q33): per-Business config
// state + PayHere collection sums — never secrets, never edits.
router.get('/summary', paymentMethodsController.adminSummary);

router.post('/:id/refund', paymentController.adminRefund);

module.exports = router;

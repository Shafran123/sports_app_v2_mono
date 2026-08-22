const express = require('express');
const paymentController = require('../controller/paymentController');

const router = express.Router();

router.post('/:id/refund', paymentController.adminRefund);

module.exports = router;

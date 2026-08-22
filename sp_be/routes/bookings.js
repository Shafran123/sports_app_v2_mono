const express = require('express');
const bookingController = require('../controller/bookingController');
const billController = require('../controller/billController');
const { authenticate } = require('../middleware/authenticate');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const bookingWriteLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 10 });

router.post('/checkout', bookingWriteLimiter, authenticate, bookingController.checkout);
router.get('/', authenticate, bookingController.listMyBookings);
router.post('/:id/cancel', bookingWriteLimiter, authenticate, bookingController.cancelBooking);
router.get('/:id', authenticate, bookingController.getBooking);
router.get('/:id/bill', authenticate, billController.downloadBookingBill);

module.exports = router;
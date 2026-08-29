const express = require('express');
const bookingController = require('../controller/bookingController');
const billController = require('../controller/billController');
const { authenticate } = require('../middleware/authenticate');
const { makeRateLimiter } = require('../middleware/rateLimit');
const { requireCaptcha } = require('../middleware/requireCaptcha');

const router = express.Router();

const bookingWriteLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 10 });

// Anti-bot Check (ticket 05): a Dedicated Site checkout carries a reCAPTCHA
// token verified server-side; a low score rejects the booking. `siteOnly`
// keeps the marketplace and the Booking Widget iframe out of scope (ADR-0042).
router.post('/checkout', bookingWriteLimiter, authenticate, requireCaptcha({ action: 'site_checkout', siteOnly: true }), bookingController.checkout);
router.get('/', authenticate, bookingController.listMyBookings);
router.post('/:id/cancel', bookingWriteLimiter, authenticate, bookingController.cancelBooking);
router.get('/:id', authenticate, bookingController.getBooking);
router.get('/:id/bill', authenticate, billController.downloadBookingBill);

module.exports = router;
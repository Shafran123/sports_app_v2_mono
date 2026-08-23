const express = require('express');
const businessController = require('../controller/businessController');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const writeLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 30 });

router.get('/courts', businessController.listCourts);
router.post('/courts', businessController.createCourt);
router.patch('/courts/:id', businessController.updateCourt);
router.put('/venues/:id/hours', businessController.updateVenueHours);
router.post('/courts/:id/blocks', businessController.createBlock);
router.get('/courts/:id/blocks', businessController.listBlocks);
router.delete('/courts/:id/blocks/:blockId', businessController.deleteBlock);
router.get('/bookings', businessController.listBookings);
router.get('/overview', businessController.overview);
router.get('/reports', businessController.reports);
router.post('/bookings/manual', writeLimiter, businessController.createManualBooking);
router.post('/bookings/:id/mark-paid', writeLimiter, businessController.markPaid);
router.post('/bookings/:id/cancel', writeLimiter, businessController.cancelBooking);
router.post('/bookings/:id/no-show', writeLimiter, businessController.markNoShow);
router.post('/bookings/:id/check-in', writeLimiter, businessController.checkIn);
router.post('/qr-checkin', writeLimiter, businessController.qrCheckIn);
router.post('/qr-lookup', writeLimiter, businessController.qrLookup);

module.exports = router;

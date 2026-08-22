const express = require('express');
const venueController = require('../controller/venueController');
const availabilityController = require('../controller/availabilityController');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.get('/', venueController.listVenues);
router.get('/mine', authenticate, venueController.listMyVenues);
router.post('/', authenticate, venueController.createVenue);
router.patch('/:id', authenticate, venueController.updateVenue);
router.post('/:id/resubmit', authenticate, venueController.resubmitVenue);
router.get('/:id/availability', availabilityController.getAvailability);
router.get('/:id', venueController.getVenue);

module.exports = router;

const express = require('express');
const eventController = require('../controller/eventController');
const billController = require('../controller/billController');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.get('/', eventController.listEvents);
router.post('/', authenticate, eventController.createEvent);
router.get('/:id', eventController.getEvent);
router.post('/:id/cancel', authenticate, eventController.cancelEvent);
router.post('/:id/register', authenticate, eventController.registerForEvent);
router.get('/:id/my-bill', authenticate, billController.downloadEventRegistrationBill);

module.exports = router;

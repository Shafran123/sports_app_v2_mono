const express = require('express');
const leadsController = require('../controller/leadsController');

const router = express.Router();

router.post('/', leadsController.submitLead);

module.exports = router;
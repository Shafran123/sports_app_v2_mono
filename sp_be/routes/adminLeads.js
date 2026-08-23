const express = require('express');
const leadsController = require('../controller/leadsController');

const router = express.Router();

router.get('/', leadsController.listLeads);
router.patch('/:id', leadsController.updateLead);

module.exports = router;
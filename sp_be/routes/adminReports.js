const express = require('express');
const adminReportsController = require('../controller/adminReportsController');

const router = express.Router();

router.get('/', adminReportsController.getReports);

module.exports = router;
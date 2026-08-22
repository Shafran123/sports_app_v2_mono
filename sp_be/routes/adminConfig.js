const express = require('express');
const adminConfigController = require('../controller/adminConfigController');

const router = express.Router();

router.get('/', adminConfigController.getConfigForAdmin);
router.get('/audit', adminConfigController.listAudit);
router.put('/flags/:name', adminConfigController.setFlag);

module.exports = router;
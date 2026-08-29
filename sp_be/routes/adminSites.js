const express = require('express');
const siteDomainController = require('../controller/siteDomainController');
const siteAuthController = require('../controller/siteAuthController');

const router = express.Router();

router.get('/', siteDomainController.listQueue);
router.post('/:id/approve', siteDomainController.approve);
router.post('/:id/reject', siteDomainController.reject);
router.post('/:id/verify', siteDomainController.verify);
router.post('/:id/mark-live', siteDomainController.markLive);
router.patch('/:id/checklist', siteDomainController.setChecklist);
// Recovery backstop (ticket 07): an Admin resets any Site Customer's Second
// Factor — also revokes all of that customer's sessions.
router.post('/customers/:id/reset-factor', siteAuthController.adminResetCustomerFactor);

module.exports = router;
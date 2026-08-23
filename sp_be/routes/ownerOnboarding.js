const express = require('express');
const ownersController = require('../controller/ownersController');

const router = express.Router();

router.get('/plan', ownersController.getMyPlan);
router.get('/agreement/current', ownersController.getCurrentAgreement);
router.get('/agreements/:id/pdf', ownersController.getAgreementPdf);
router.post('/agreements/:id/accept', ownersController.acceptAgreement);
router.post('/agreements/:id/decline', ownersController.declineAgreement);
router.post('/password-changed', ownersController.passwordChanged);

module.exports = router;
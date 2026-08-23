const express = require('express');
const ownersController = require('../controller/ownersController');

const router = express.Router();

router.get('/plan-templates', ownersController.listPlanTemplates);
router.post('/plan-templates', ownersController.createPlanTemplate);
router.patch('/plan-templates/:id', ownersController.updatePlanTemplate);
router.post('/plan-templates/:id/archive', ownersController.archivePlanTemplate);

router.get('/', ownersController.listOwners);
router.post('/', ownersController.createOwner);
router.post('/:id/renew', ownersController.renewOwner);
router.post('/:id/nudge', ownersController.nudgeOwner);

module.exports = router;
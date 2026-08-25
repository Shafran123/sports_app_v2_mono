const express = require('express');
const siteDomainController = require('../controller/siteDomainController');

const router = express.Router();

router.get('/', siteDomainController.listQueue);
router.post('/:id/approve', siteDomainController.approve);
router.post('/:id/reject', siteDomainController.reject);
router.post('/:id/verify', siteDomainController.verify);
router.post('/:id/mark-live', siteDomainController.markLive);
router.patch('/:id/checklist', siteDomainController.setChecklist);

module.exports = router;
const express = require('express');
const leadsController = require('../controller/leadsController');
const { requireCaptcha } = require('../middleware/requireCaptcha');

const router = express.Router();

// Anti-bot Check (ticket 06): the owner-lead form ("list your place" and the
// demo CTA — one pipeline) carries a reCAPTCHA token verified server-side; a
// low score rejects the submission.
router.post('/', requireCaptcha({ action: 'lead_submit' }), leadsController.submitLead);

module.exports = router;
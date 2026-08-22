const express = require('express');
const authController = require('../controller/authController');
const verifyPhoneController = require('../controller/verifyPhoneController');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

router.get('/me', authController.getMe);
router.patch('/me', authController.updateMe);
router.post('/verify-phone/send', verifyPhoneController.sendVerificationCode);
router.post('/verify-phone/confirm', verifyPhoneController.confirmVerification);

module.exports = router;

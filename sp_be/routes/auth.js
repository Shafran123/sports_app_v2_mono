const express = require('express');
const authController = require('../controller/authController');
const verifyPhoneController = require('../controller/verifyPhoneController');
const emailVerifyController = require('../controller/emailVerifyController');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

router.get('/me', authController.getMe);
router.patch('/me', authController.updateMe);
router.post('/verify-phone/send', verifyPhoneController.sendVerificationCode);
router.post('/verify-phone/confirm', verifyPhoneController.confirmVerification);
router.post('/verify-email/send', emailVerifyController.sendVerificationCode);
router.post('/verify-email/confirm', emailVerifyController.confirmVerification);

module.exports = router;

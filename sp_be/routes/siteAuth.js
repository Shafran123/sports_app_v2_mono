// Site Customer auth routes (ADR-0030): our own auth for Dedicated Site /
// Booking Widget customers — per-Business accounts, never Firebase. Every
// action is scoped by the site hostname the customer is acting on.

const express = require('express');
const siteAuthController = require('../controller/siteAuthController');
const { makeRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const authLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 30 });
const otpLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 10 });

router.post('/register', authLimiter, siteAuthController.register);
router.post('/login', authLimiter, siteAuthController.login);
router.post('/google', authLimiter, siteAuthController.google);
router.get('/me', siteAuthController.requireSiteCustomer, siteAuthController.me);
router.post('/logout', siteAuthController.requireSiteCustomer, siteAuthController.logout);
router.post('/verify-phone/send', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.sendPhoneCode);
router.post('/verify-phone/confirm', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.confirmPhoneCode);
router.post('/verify-email/send', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.sendEmailCode);
router.post('/verify-email/confirm', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.confirmEmailCode);

module.exports = router;
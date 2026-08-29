// Site Customer auth routes (ADR-0030): our own auth for Dedicated Site /
// Booking Widget customers — per-Business accounts, never Firebase. Every
// action is scoped by the site hostname the customer is acting on.

const express = require('express');
const siteAuthController = require('../controller/siteAuthController');
const { makeRateLimiter } = require('../middleware/rateLimit');
const { assessCaptcha } = require('../middleware/requireCaptcha');

const router = express.Router();

const authLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 30 });
const otpLimiter = makeRateLimiter({ windowMs: 60 * 1000, limit: 10 });

// Anti-bot Check (ticket 05): sign-in and registration carry a reCAPTCHA v3
// token verified server-side. `siteOnly` keeps the Booking Widget iframe out
// of scope (ADR-0042) — its platform-origin requests never hit the gate. A
// low score is not a hard block here: the controller escalates to an email-OTP
// challenge instead.
router.post('/register', authLimiter, assessCaptcha({ action: 'site_register', siteOnly: true }), siteAuthController.register);
router.post('/login', authLimiter, assessCaptcha({ action: 'site_login', siteOnly: true }), siteAuthController.login);
router.post('/challenge/confirm', otpLimiter, siteAuthController.confirmChallenge);
router.post('/google', authLimiter, siteAuthController.google);
router.get('/me', siteAuthController.requireSiteCustomer, siteAuthController.me);
router.post('/logout', siteAuthController.requireSiteCustomer, siteAuthController.logout);
router.post('/verify-phone/send', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.sendPhoneCode);
router.post('/verify-phone/confirm', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.confirmPhoneCode);
router.post('/verify-email/send', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.sendEmailCode);
router.post('/verify-email/confirm', otpLimiter, siteAuthController.requireSiteCustomer, siteAuthController.confirmEmailCode);

module.exports = router;
# 02 — SMS + phone-verification gates read flags

Type: task
Status: ready-for-agent

## Purpose

SMSGo needs business registration before it can send; verification must become optional at the flag level, and `sms_enabled` must silence all SMS.

## Changes

- `sms_enabled` OFF → `utils/smsService.js` logs "SMS disabled by flag" and returns; ON → sends normally. Single choke point, covers confirmations, cancellations, OTP.
- `phone_verification_required` OFF → `bookingController.js:55` gate evaluates flag: OFF lifts the 409 entirely (server-side truth taken from the flag).
- Keep OTP endpoints functional regardless (verify/send + confirm still work when flag OFF — admins can still mark verified).

## Audit

- [ ] smsService short-circuits on flag OFF; sends flow when ON.
- [ ] checkout allows unverified users when flag OFF; rejects with 409 when ON.
- [ ] Regression: existing verified-phone tests pass with flag ON (test env seed). New test for OFF path.

## Blocked by: 01
## Completed

Implemented. Evidence: sp_be commit `b50c281` (backend) + root commit `2a1b4ed` (frontend/types/spec). Backend suite 214/214, user 39/39, admin 11/11, api 22/22 green; all packages typecheck.

# 03 — PayHere flag + cash-only checkout when disabled

Type: task
Status: ready-for-agent

## Purpose

PayHere integration is dormant (needs business registration / gateway credentials). Users must never reach a broken online-payment flow.

## Changes

- `payhere_enabled` OFF → checkout: server rejects `payment_method='online'` with `409 PAYMENT_UNAVAILABLE` before hold creation (bookingController); client (apps/user checkout) shows cash-only.
- ON → existing hold + `payment_params` flow unchanged.

## Audit

- [ ] server 409 on online when OFF; cash works.
- [ ] client checkout UI only offers pay-at-venue when OFF; both when ON.
- [ ] tests both sides.

## Blocked by: 01
## Completed

Implemented. Evidence: sp_be commit `b50c281` (backend) + root commit `2a1b4ed` (frontend/types/spec). Backend suite 214/214, user 39/39, admin 11/11, api 22/22 green; all packages typecheck.

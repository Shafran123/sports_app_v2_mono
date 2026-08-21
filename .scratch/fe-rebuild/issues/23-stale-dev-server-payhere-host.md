# 23 — Critical: stale dev server + PayHere redirect/host

**Status:** ready-for-agent
**Depends on:** none

## What to build
- Kill the stale old-build dev server squatting on `:3000` (same app). The current app runs on `:3002` — the user's checkout URL.
- Make PayHere `return_url` / `notify_url` **derive from the request host** (the port the checkout started on), instead of hardcoded `localhost:3000`. So post-payment the player lands back on the port they used.

## Acceptance
- [ ] Only one user-app dev server runs (no duplicate on :3000)
- [ ] Checkout on `:3002` completes; PayHere return lands back on `:3002`
- [ ] Webhook `notify_url` points at the same origin
- [ ] Headless loop: login → checkout → 201 "Pay now" renders (no `:3000` reference)

## Notes
- Fix in `sp_be/utils/payhere.js` buildCheckoutParams — take the base origin from the request (req.headers.host / x-forwarded-host) or from an env override; fall back to a default.
- The stale server is environmental; document `dev.sh` to avoid two instances. Verify no old `.next` references remain.
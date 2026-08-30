# 05 — PayHere credential resolution (checkout params, IPN, refunds)

**What to build:** every PayHere interaction resolves which credential set to use — per-Business (from 02/03) or platform — and the legacy rule holds: payments created before the change stay platform-credentialed forever.

- **Resolution function**: given a Booking/Payment, resolve creds → Business creds when the payment belongs to a Booking whose surface is site/widget/walk-in-link; platform creds for Events and for payments whose `payhere_payment_id` predates the change (flag: a `credential_scope` marker — e.g. `business_id` column on `payments`, null = platform — set at creation, never rewritten).
- **Checkout params** (`sp_be/utils/payhere.js` `buildCheckoutParams`): merchant_id + hash from the resolved creds; sandbox checkout URL while `PAYHERE_SANDBOX`-equivalent global is set.
- **IPN** (`paymentController.js` notify): verify `md5sig` with the resolved Business's merchant secret — a webhook must never fall back to the platform secret for a business-credentialed payment; unknown business → reject.
- **Refunds**: platform refunds (admin, legacy) keep `PAYHERE_AUTHORIZATION`; owner refunds use the Business's app ID/app secret OAuth flow (08). Failed refund → existing `needs_manual_refund` flag.
- **Retention on disable**: disabling a method retains creds until the Business has no outstanding (pending/paid) bookings; "remove keys" (03) is the explicit deletion — after deletion, any outstanding refund for that Business escalates to admin manual refund.

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] `payments.credential_scope`-style column in 01's migration; resolution unit-tested for both scopes
- [ ] IPN rejects business payments with platform-secret attempts and vice versa
- [ ] Retention-on-disable logic; refund escalation after key removal
- [ ] Sandbox flag read from env; live switch deferred to launch
# 10 — Dedicated Site PayHere checkout

**What to build:** the Dedicated Site's checkout offers PayHere per the Business's config — the existing redirect flow (hidden form POST to PayHere, return/cancel/notify URLs) wired to Business credentials instead of the platform's.

- Checkout page (Dedicated Site, `apps/user` site surfaces): payment method choice rendered from the Business's enabled methods — cash and/or payhere; no method enabled → block with "contact the venue" (fail-closed).
- PayHere path: hold + `payment_params` built with Business creds (05), same 10-min hold/expiry invariants as today; redirect to PayHere (sandbox URL); return lands on the existing success screen; IPN confirms (05).
- Site Customer flows already require verified phone/email; unchanged.
- The `payhere_enabled` global kill switch still gates online here (04).

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Site checkout renders enabled methods only; disabled/absent → fail-closed message
- [ ] PayHere redirect uses Business creds; sandbox end-to-end pay → confirmed
- [ ] Hold invariants unchanged; dismissal/cancel returns correctly
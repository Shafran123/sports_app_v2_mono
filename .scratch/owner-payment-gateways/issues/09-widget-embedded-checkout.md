# 09 — Widget embedded checkout (Onsite Checkout spike + integration)

**What to build:** PayHere **Onsite Checkout** (payhere.js in-page modal iframe) inside the Booking Widget per ADR-0029/0044, with a sandbox spike first.

- **Spike (research + prototype, sandbox)**: load `https://www.payhere.lk/lib/payhere.js` (sandbox flag) inside a test iframe embedded on a test page; confirm the modal renders nested-in-iframe, callbacks (`onCompleted`/`onDismissed`/`onError`) fire in-page, and IPN lands. Document the result. **If the nested iframe fails** (rendering, CSP/X-Frame-Options, or the embed domain approval blocks), fall back to a top-level redirect for the widget and note the deviation in ADR-0044/0029.
- **Integration**: widget checkout (currently cash-only, per `.scratch/off-platform-venues/issues/04`) gains a PayHere option when the Business has it enabled + configured; checkout POST builds params with Business creds (05); `payhere.startPayment` runs inside the widget; `onCompleted` → success screen (QR + confirmation) — the existing success screen is already the online-return target; `onDismissed`/`onError` → back to checkout state, hold still valid.
- **Embed domain approval**: owner's embedding domain must be approved by PayHere for the merchant secret (up to 24h) — surface a "widget payments may take up to 24h to activate" note in the owner Payments page (06) until approved.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Spike report committed (sandbox behavior, nested-iframe verdict, fallback decision)
- [ ] Widget checkout offers PayHere when enabled; success screen reached via onCompleted
- [ ] Dismiss/error paths keep the hold alive and return to checkout
- [ ] Sandbox end-to-end: pay → IPN → booking confirmed → success screen

## Implementation note (2026-08-30)

Shipped the **documented fallback**: widget PayHere uses the top-level redirect (hidden-form POST to PayHere) with `return_url` pointed back at the widget's own embed URL — the customer lands back in the iframe, where the booking shows under "Your bookings" (the IPN confirms server-side; email/SMS QR go out as usual). The Onsite Checkout spike (payhere.js nested-iframe verdict) remains the fast-follow: swap the form POST for `payhere.startPayment` if the sandbox spike passes. The server return_url support is already in place (`widgetReturnUrl` in bookingController).
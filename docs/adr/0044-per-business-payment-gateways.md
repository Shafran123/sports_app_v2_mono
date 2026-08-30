# 0044 — Per-business payment gateways with Secret-Manager-held owner credentials

**Status:** accepted (credential storage amended by ADR-0047)

## Context

Online payments ran on a single platform PayHere gateway (`PAYHERE_MERCHANT_ID/SECRET` in env), gated by an admin `payhere_enabled` flag; cash acceptance was a per-venue boolean (`venues.accepts_cash`). Owners need to collect PayHere money directly into their own account — enabled or disabled per Business from their console, with their own sandbox credentials — shown per Business on the Dedicated Site, Booking Widget, and walk-in flows. The marketplace is being retired (ADR-0045), so no marketplace surface needs rework.

## Decision

Payment methods move from per-venue (`accepts_cash`) and per-platform (env keys) to **per-Business**, stored in a new `business_payment_methods` table (one row per method `cash` | `payhere`, with `enabled` and config). At least one method must stay enabled (server-guarded). A Booking records its method as `cash` or `payhere` (legacy `online` rows migrate to `payhere`); `card` is added as a recorded *collection channel* for walk-in terminal payments, not a bookable method.

**Credentials:** the owner supplies four PayHere fields — merchant ID, merchant secret, app ID, app secret (the app pair is required for the refund API's OAuth). The two secrets live in **Google Secret Manager**, one secret per Business (`business-payhere-<businessId>`), per ADR-0047; the DB row keeps only the non-secret IDs. Runtime secret fetch is an in-memory cache with a short TTL, invalidated on owner save, so IPN verification never blocks on the manager. Without `SECRET_MANAGER_CREDENTIALS` (local dev, tests) the platform env keys stand in for the business credentials and the owner save/remove endpoints refuse to run.

**Credential sources:** two gateways now exist. The **per-business gateways** serve every new booking (Dedicated Site, Booking Widget, walk-in Payment Links). The **platform gateway** (env keys, unchanged) serves only Events and legacy refunds — payments created before this change stay platform-credentialed forever; credential resolution follows the payment's surface, never its age beyond that rule.

**Checkout behavior:**
- Disabling a method blocks new checkouts only; existing pending/paid bookings stay refundable, and credentials are retained until no outstanding bookings. A separate "remove keys" action clears the stored credentials.
- The admin `payhere_enabled` flag remains as a global emergency kill switch for all PayHere flows.
- Widget checkout uses PayHere **Onsite Checkout** (payhere.js in-page modal iframe, sandbox-supported) per ADR-0029; a sandbox spike validates nested-iframe behavior first, with redirect as the documented fallback. Note: the embedding domain must be approved by PayHere (up to 24h).
  - **Implemented (2026-08-30)**: shipped the redirect fallback — hidden-form POST with `return_url` pointed back at the widget's own embed URL; Onsite Checkout (payhere.js) remains the fast-follow pending the sandbox spike's nested-iframe verdict.
  - **Onsite Checkout shipped for the site/marketplace checkout page (2026-08-30)**: `startPayHereCheckout` (payhere.js, `PayHere.startCheckout`) keeps the player in-page; the confirmation lands via the notify-webhook poll and reuses the pay-at-venue confirmation card. The widget embed keeps the redirect fallback (nested iframe).
- Walk-in quick-book gains a **Payment Link** (backend-minted checkout URL sent by SMS via SMSGo) and a `card` recorded channel; walk-ins book `confirmed` at creation, payment `pending` until the link is paid.
- Owners can **cancel & refund** their own PayHere bookings from the console (platform cancellation tiers, owner credentials); standalone refunds are deferred.
- Admin gets a read-only per-Business summary: config state + collection sums, never the secrets.
- Sandbox is global (sandbox checkout URL) until launch, when owners re-enter live keys.

## Trade-offs

- **Per-business vs per-venue**: one place to configure matches how owners think; a venue that differs can be added later at small cost.
- **Secrets manager per tenant vs a shared store**: one secret per Business (keyed by the Business id) instead of encrypted ciphertext in Postgres removes all secret material from the tenant DB and its backups — a DB leak no longer leaks credentials — at the cost of a manager dependency on save/remove and a cached GSM read at checkout/IPN time. See ADR-0047 for the full trade-off.
- **Embedded vs redirect for the widget**: embedded keeps the customer inside the owner's page (ADR-0029's P2 intent) at the risk of undocumented nested-iframe behavior; the spike decides, redirect documented as fallback.
- **Cash recorded walk-in vs `card` value**: card-as-channel keeps platform reports honest about where money came from without pretending a terminal swipe produced a gateway webhook.

## Consequences

- Migration: create `business_payment_methods`, backfill (business cash ON if any venue had it), drop `venues.accepts_cash`, migrate `online` → `payhere` in `bookings.payment_method` and `payments.payment_method`.
- Backend: business payment-methods API (toggles, credential save/validate/remove), per-business checkout gate, per-business PayHere params/hash/IPN/refund resolution, Payment Link minting + SMS, owner refund endpoint.
- Frontend: owner console **Payments** page (toggles + four credential fields + connected badge + remove keys), widget Onsite Checkout, Dedicated Site PayHere wiring, admin read-only summary.
- Secrets: per-Business PayHere credentials in Google Secret Manager (ADR-0047); platform env keys stay in the deployment env, unchanged.
- CONTEXT.md: **Payment Method**, **Payment Link** added; Payment/Cash Payment/Booking/Auto-confirm/Pending Auto-cancel/Cancellation swept from "online" to PayHere; `card` channel documented.
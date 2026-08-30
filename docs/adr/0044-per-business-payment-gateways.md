# 0044 — Per-business payment gateways with encrypted owner credentials

**Status:** accepted

## Context

Online payments ran on a single platform PayHere gateway (`PAYHERE_MERCHANT_ID/SECRET` in env), gated by an admin `payhere_enabled` flag; cash acceptance was a per-venue boolean (`venues.accepts_cash`). Owners need to collect PayHere money directly into their own account — enabled or disabled per Business from their console, with their own sandbox credentials — shown per Business on the Dedicated Site, Booking Widget, and walk-in flows. The marketplace is being retired (ADR-0045), so no marketplace surface needs rework.

## Decision

Payment methods move from per-venue (`accepts_cash`) and per-platform (env keys) to **per-Business**, stored in a new `business_payment_methods` table (one row per method `cash` | `payhere`, with `enabled` and config). At least one method must stay enabled (server-guarded). A Booking records its method as `cash` or `payhere` (legacy `online` rows migrate to `payhere`); `card` is added as a recorded *collection channel* for walk-in terminal payments, not a bookable method.

**Credentials:** the owner supplies four PayHere fields — merchant ID, merchant secret, app ID, app secret (the app pair is required for the refund API's OAuth). The two secrets are encrypted at rest with AES-256-GCM (the existing siteTotp pattern) under a master key (`MASTER_ENCRYPTION_KEY`) held in **GCP Secret Manager**, the single secrets manager for all backend env (platform PayHere keys, Mailgun, SMSGo, OTP secret, Firebase) per ADR-0046. Runtime secret fetch is an in-memory cache with a short TTL, invalidated on owner save, so IPN verification never blocks on the manager.

**Credential sources:** two gateways now exist. The **per-business gateways** serve every new booking (Dedicated Site, Booking Widget, walk-in Payment Links). The **platform gateway** (env keys, unchanged) serves only Events and legacy refunds — payments created before this change stay platform-credentialed forever; credential resolution follows the payment's surface, never its age beyond that rule.

**Checkout behavior:**
- Disabling a method blocks new checkouts only; existing pending/paid bookings stay refundable, and credentials are retained until no outstanding bookings. A separate "remove keys" action clears the stored credentials.
- The admin `payhere_enabled` flag remains as a global emergency kill switch for all PayHere flows.
- Widget checkout uses PayHere **Onsite Checkout** (payhere.js in-page modal iframe, sandbox-supported) per ADR-0029; a sandbox spike validates nested-iframe behavior first, with redirect as the documented fallback. Note: the embedding domain must be approved by PayHere (up to 24h).
  - **Implemented (2026-08-30)**: shipped the redirect fallback — hidden-form POST with `return_url` pointed back at the widget's own embed URL; Onsite Checkout (payhere.js) remains the fast-follow pending the sandbox spike's nested-iframe verdict.
- Walk-in quick-book gains a **Payment Link** (backend-minted checkout URL sent by SMS via SMSGo) and a `card` recorded channel; walk-ins book `confirmed` at creation, payment `pending` until the link is paid.
- Owners can **cancel & refund** their own PayHere bookings from the console (platform cancellation tiers, owner credentials); standalone refunds are deferred.
- Admin gets a read-only per-Business summary: config state + collection sums, never the secrets.
- Sandbox is global (sandbox checkout URL) until launch, when owners re-enter live keys.

## Trade-offs

- **Per-business vs per-venue**: one place to configure matches how owners think; a venue that differs can be added later at small cost.
- **Encrypted at rest + one master key vs a full external manager per credential**: a secrets manager per credential would add infra and a runtime fetch on every IPN; the master key in GCP Secret Manager (ADR-0046) keeps ciphertext in Postgres while removing all plaintext from the repo/env.
- **Embedded vs redirect for the widget**: embedded keeps the customer inside the owner's page (ADR-0029's P2 intent) at the risk of undocumented nested-iframe behavior; the spike decides, redirect documented as fallback.
- **Cash recorded walk-in vs `card` value**: card-as-channel keeps platform reports honest about where money came from without pretending a terminal swipe produced a gateway webhook.

## Consequences

- Migration: create `business_payment_methods`, backfill (business cash ON if any venue had it), drop `venues.accepts_cash`, migrate `online` → `payhere` in `bookings.payment_method` and `payments.payment_method`.
- Backend: business payment-methods API (toggles, credential save/validate/remove), per-business checkout gate, per-business PayHere params/hash/IPN/refund resolution, Payment Link minting + SMS, owner refund endpoint.
- Frontend: owner console **Payments** page (toggles + four credential fields + connected badge + remove keys), widget Onsite Checkout, Dedicated Site PayHere wiring, admin read-only summary.
- Secrets: GCP Secret Manager wired into Railway (ADR-0046); `MASTER_ENCRYPTION_KEY` master key added (required at boot); siteTotp encryption service generalized.
- CONTEXT.md: **Payment Method**, **Payment Link** added; Payment/Cash Payment/Booking/Auto-confirm/Pending Auto-cancel/Cancellation swept from "online" to PayHere; `card` channel documented.
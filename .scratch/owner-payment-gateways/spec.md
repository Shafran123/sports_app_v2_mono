# Owner Payment Gateways — spec

Per-Business payment methods replace the per-venue `accepts_cash` boolean and the platform-only PayHere gateway. Owners configure **Cash** and **PayHere** per Business in their console; enabled methods determine what customers can pay with on the Dedicated Site, Booking Widget, and walk-in flows. The marketplace is retired (ADR-0045). Full design: ADR-0044, ADR-0045.

## Settled decisions (grill 2026-08-30)

- **Model**: `business_payment_methods` table — one row per method (`cash` | `payhere`), `enabled` + config. At least one method must stay enabled (server-guarded). No per-venue override. `venues.accepts_cash` dropped; backfill: business cash ON if *any* venue had it.
- **Values**: bookings/payments `payment_method` migrate `'online'` → `'payhere'`; `'card'` added as a recorded walk-in collection channel (not a bookable method).
- **Credentials**: owner supplies merchant ID, merchant secret, app ID, app secret. Secrets AES-GCM encrypted at rest (siteTotp pattern), master key in Doppler. All backend env moves to Doppler. In-memory credential cache, TTL ~5 min, invalidated on owner save.
- **Badge**: app creds validate instantly (OAuth token call); merchant secret provable only on first transaction → "Configured / Invalid app credentials / Awaiting first transaction".
- **Checkout**: Dedicated Site — PayHere (redirect) + cash per Business. Booking Widget — **embedded Onsite Checkout** (payhere.js), sandbox spike first, redirect fallback documented. Walk-in — cash, `card` (terminal), or **Payment Link** (backend-minted → SMS via SMSGo; booking `confirmed` at creation, payment `pending` until paid).
- **Disable semantics**: blocks new checkouts only; existing bookings stay refundable; separate "remove keys" action deletes credentials.
- **Refunds**: owner cancel-&-refund from console (platform cancellation tiers, owner creds). Standalone refunds deferred.
- **Admin**: read-only per-Business summary — config state + collection sums, never secrets.
- **Kill switch**: admin `payhere_enabled` stays as global emergency switch (site/widget/events).
- **Gateways**: per-business gateways for all new bookings; platform gateway for Events + legacy refunds only (payments created before the change stay platform-credentialed forever).
- **Sandbox**: global sandbox checkout URL until launch; owners re-enter live keys then.
- **Marketplace**: retired — player app routes → slate; no development; existing bookings play out via email QR; cancellation owner/admin-assisted.
- **Events**: out of scope — platform gateway; per-business gateways for events noted as future step.

## Out of scope

Marketplace rework, Events, per-venue method overrides, standalone (non-cancel) refunds, per-business sandbox/live toggle, payment links via API from PayHere portal (we mint our own).

## Tickets

01 Migration · 02 Secrets & Doppler · 03 Business payment-methods API · 04 Per-business checkout gate · 05 PayHere credential resolution · 06 Owner Payments page · 07 Admin read-only summary · 08 Owner cancel & refund · 09 Widget embedded checkout · 10 Dedicated Site PayHere · 11 Walk-in Payment Link + card · 12 Marketplace retirement · 13 Events boundary & docs sweep
# ADR-0015 — Payment trust: server-derived amounts and fail-closed webhook verification

- **Status:** accepted
- **Date:** 2026-08-22
- **Extends:** ADR-0003 (PayHere as the gateway)

## Context

PayHere webhook HMAC verification exists, but the merchant secret fell back to a **public test string** when env was missing, and bookmarking of the hold/registration ID happened without an on-webhook amount check. If the secret is ever defaulted, forging a paid webhook for one's own hold grants free bookings.

## Decision

The trust boundary is: **amounts are derived server-side from DB rows, never accepted from any client; the webhook is only honored when its HMAC verifies against the real configured merchant secret — and if the secret is absent, the API refuses to boot** (fail-closed, see ticket 01). Cash payments continue as owner-recorded paid rows (ADR-0008): a separate owner-authenticated path, never a webhook.

## Trade-offs

- Fail-closed boot adds operational friction (Railway must have secrets set before first deploy) — cheaper than a forgery incident.
- Amount derived server-side means the client cannot set a price even for a legitimate feature (e.g. discounts must be server rules), and the webhook's posted `payhere_amount` is informational only.

## Consequences

- `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` are required env; missing → no boot.
- Webhook identity = HMAC + merchant_id match; idempotency by `payhere_payment_id` (existing unique index) stays.
- `payhere_amount` isn't compared to `payments.amount` — the signature already binds both; a future audit should add the comparison as a cheap invariant rather than the source of truth.
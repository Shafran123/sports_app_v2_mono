# 0023 — Notification catalog + channel scope

- **Status:** accepted
- **Date:** 2026-08-24
- **Supersedes:** the SMS-scope restriction in ADR-0012 (booking-confirm + admin-cancel only)

## Decision

All transactional notifications flow through a single catalog — `sp_be/utils/notificationCatalog.js` — a key → channel-plan registry with one `dispatch(key, payload)` that resolves recipients by role (player / owner / admin / registrants), fans out fire-and-forget to in-app rows, email (Mailgun), and SMS (SMSGo.lk), and records every attempt in an `outbound_messages` audit table.

Channel scope is broadened from ADR-0012: SMS now covers the full booking lifecycle (confirmation, reminder, cancellations, walk-ins) plus OTP verification. Venue Owners are notified (email + SMS) on booking confirmation and player-initiated cancellation. Per-event SMS is gated by a `sms_events` config key under the `sms_enabled` master flag, so owner-SMS can be disabled without code once SMSGo starts billing. Email stays on the Mailgun free tier (100/day) at launch volumes.

## Why

Sends were scattered across ~10 files with no audit trail — invisible while SMSGo was unapproved, and no record once live. Several events notified nobody (player-cancel, owner-cancel, walk-in, event registration/cancellation). Owner-side notification is core to the marketplace: owners must know bookings happened on their venue. The audit table doubles as a pre-approval dry-run (skipped sends are recorded). The catalog makes the per-event SMS gate — the cost-control for SMSGo billing — a config change instead of a code change.

## Consequences

- One registry to read for "what does this event send, to whom, on which channel."
- `utils/notify.js` and `services/notifications.js` are deleted; transports stay thin.
- OTP is the exception: it keeps a direct synchronous `sendSms` (the controller needs the result) but writes an audit row.
- SMS cost exposure is controlled per key; the `sms_events` default includes all transactional keys.
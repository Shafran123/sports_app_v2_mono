# Notification catalog — structured email & SMS

Status: ready-for-agent

## Problem Statement

Transactional sends are scattered across ~10 files in `sp_be/`, each with bespoke plumbing: `utils/emailService.js` (Mailgun), `utils/smsService.js` (SMSGo), `utils/notify.js`, `services/notifications.js` (dead code — zero callers), plus inline `sendEmail` calls in `leadsController.js`, `billService.js`, `dailyDigest.js`, `ownersController.js`, `routes/adminVenues.js`, `middleware/authenticate.js`. Consequences:

- **No audit trail.** Nothing records what was sent or skipped. Until SMSGo approves the account, there is no record of "what would have been sent" — the sends just log-and-skip.
- **SMS scope is narrower than wanted.** ADR-0012 limits SMS to booking confirm + admin-cancel. The agreed scope is the full booking lifecycle (confirm, reminder, cancellations, walk-ins) + OTP.
- **Notification gaps.** Player-initiated cancellation notifies nobody; owner/admin cancellation sends SMS only (no email); owner gets no confirm/cancel alert; walk-in bookings notify nobody; event registration confirm and event-cancelled notify nobody.
- **Branding drift.** Templates hardcode "MySlot.LK" while `brand_name` is admin-configurable (only the digest + PDFs use it).
- **In-app notifications are hand-rolled** in two controllers and absent everywhere else.

## Solution

Introduce a **notification catalog** — `sp_be/utils/notificationCatalog.js` — a single registry that maps a message key to its channel plan and template builders, plus a `dispatch(key, payload)` that resolves recipients by role, fans out fire-and-forget to enabled channels (in-app row, email, SMS), and records every attempt in an `outbound_messages` audit table. `emailService.js` and `smsService.js` remain thin transports.

### Message catalog (key → recipients × channels)

| Key | Player email | Player SMS | Owner email | Owner SMS | In-app | Trigger |
|---|---|---|---|---|---|---|
| `booking.confirmed` | ✅ | ✅ | ✅ | ✅ | player | payment confirmed (online) / cash checkout |
| `booking.reminder` | ✅ | ✅ | — | — | — | T-24h job |
| `booking.bill` | ✅ | — | — | — | — | payment confirmed / cash marked paid |
| `booking.cancelled.player` | ✅ | ✅ | ✅ | ✅ | player | player cancels |
| `booking.cancelled.owner` | ✅ | ✅ | — | — | player | owner cancels |
| `booking.cancelled.admin` | ✅ | ✅ | — | — | player | admin cancels |
| `booking.walkin_created` | — | ✅ | — | — | — | manual/quick-book |
| `event.registered` | ✅ | ✅ | — | — | player | registration confirmed |
| `event.cancelled` | ✅ | ✅ | ✅ | — | registrant | event cancelled |
| `otp.code` | — | ✅ | — | — | — | phone verification |
| `signup.welcome` | ✅ | — | — | — | — | new Firebase user |
| `venue.approved` / `venue.rejected` | — | — | ✅ | — | — | admin review |
| `owner.welcome` / `owner.renewal` / `owner.nudge` | — | — | ✅ | — | — | owner plan events (PDF attachments) |
| `lead.new` | — | — | admins ✅ | — | admins | lead form |
| `digest.daily` | — | — | admins ✅ | — | — | 06:06 Colombo job |

**Rows marked NEW** (no notification today): `booking.cancelled.player`, `booking.cancelled.owner`, `booking.walkin_created`, `event.registered`, `event.cancelled`, plus all owner-side rows.

### Dispatch rules

- **Fire-and-forget** like today — dispatch never throws and never blocks the caller.
- **Recipients** resolved by role from the payload (booking → player from `user_email`/`player_phone`, owner from `users.id = venue_owner_id`; admins queried by role).
- **In-app rows** go through the catalog's in-app channel (`notifications` table), so `services/notifications.js` (dead) is deleted and the inline inserts in `paymentController.js`/`leadsController.js` are replaced.
- **OTP is the exception**: `verifyPhoneController.js` needs the synchronous send result before storing the code, so OTP keeps the direct `sendSms` call but records the audit row.
- **Audit**: `outbound_messages` (channel, to, message_key, status `sent`/`skipped`/`failed`, provider_ref/error, sent_at) written for every attempt — including SMSGo `skipped` (flag off / not configured) so pre-approval dry-runs are visible. No UI; read via SQL.
- **SMS gating**: the `sms_enabled` master flag stays; add a `sms_events` config key (array of enabled SMS keys) so per-event SMS (e.g. owner confirm SMS) can be cut without code.

## Glossary

`CONTEXT.md` updated: **Email Notification** and **SMS Notification** broadened to the booking lifecycle; **Booking Alert** added (owner-side booking notice, distinct from player-facing Booking Confirmation).

## Done criteria

- [ ] `dispatch(key, payload)` powers all notification call sites listed above; `utils/notify.js` + `services/notifications.js` deleted
- [ ] Every send attempt (incl. SMSGo skip) lands in `outbound_messages`
- [ ] NEW rows live: player-cancel (email+SMS both roles), owner-cancel, walk-in SMS, event confirm, event-cancelled
- [ ] Brand name read from config in every subject/body
- [ ] `sms_events` gate wired; `sms_enabled` still master
- [ ] ADR-0023 recorded; tests green

## Comments

Implemented in commit `a213de5` (2026-08-24). Delivery notes: `event.bill` was added to the catalog to keep the existing event bill email path (not in the original table, deliberate); `outbound_messages` uses `recipient` for the destination column (ticket said `to`); email subjects stay brand-free (no hardcoded brand) while all bodies/footers read `brand_name` — a conscious deviation from the literal "every subject" wording.
# Feature Flags, Tax, & Admin Reports

Status: ready-for-agent

## Problem Statement

Two major features:

1. **SMSGo cannot send SMS right now** (requires "BR" — business registration), so phone verification via SMS OTP is blocked. We cannot force SMS verification for booking. We need admin-controlled **Feature Flags** that govern platform behavior — including skipping phone verification — plus an **Event discovery state** (enabled / coming-soon / hidden) and a gate for the dormant PayHere integration.
2. **Admin reporting**: charts, all tax configuration, and a **Booking Bill** (PDF invoice) generated per booking/registration and emailed. Plus a daily admin digest email.

## Feature Flags — model

- Flags live in the existing `platform_config` table (key/value jsonb), administered in a new admin **Platform Settings** console section.
- **Canonical registry** in the backend: `utils/featureFlags.js` defines each flag: name, type (boolean | string-enum), default, description. Single source of truth.
- Whether a flag is on/off is read **server-side on every gated request** (direct DB read of `platform_config`, not cached) — instant propagation, one code path, at this scale performance-agnostic.
- **Audit trail** — `flag_audits` table: which admin, old value, new value, timestamp. Appended on every change.
- Player app reads a minimal **public read endpoint**; admin console gets read/write endpoints.

### Flags

| Flag | Type | Default | Behavior when off |
|---|---|---|---|
| `phone_verification_required` | boolean | **OFF** | Lifts the 409 `VERIFIED_PHONE_REQUIRED` gate at checkout entirely (unverified users can book). Verify prompts become dismissible everywhere; OTP endpoints still work. When ON, the server gate (bookingController.js:55) is enforced. |
| `sms_enabled` | boolean | **OFF** | When OFF, all outbound SMS (booking confirmation, admin-initiated cancellation, OTP sends) silently skip with a log line — never fails the request, no queuing. When ON, sends flow via SMSGo. |
| `payhere_enabled` | boolean | **OFF** | When OFF, checkout UI offers only **pay-at-venue (cash)**; server rejects non-cash attempts with `409 PAYMENT_UNAVAILABLE`. When ON, existing hold + `payment_params` flow is active. (PayHere code stays in tree, dormant + tested.) |
| `events_discovery_state` | string: `enabled` / `coming_soon` / `hidden` | `enabled` | Platform-level state for how Events appear to players: **enabled** = listings purchasable (current); **coming_soon** = teaser cards (photo, city, date, name + "Listing paused by [BrandName]" tag), not purchasable, no notify-me; **hidden** = Events section removed from player app entirely. |

- Events twist: when Coming Soon, admin-created events are stored normally and auto-become purchasable when flipped back to Enabled — the flag is the only filter, no per-event migration.
- Venue-owner console unaffected in `enabled`; in `hidden`/`coming_soon` they keep creating/updating events, with a `"Listing paused by <brand>"` banner.

## Tax

- Configurable `platform_config` key `tax_rate` (number, percentage, default 0). Admin-editable in Platform Settings.
- Applied the **server at checkout**: `tax = round(base × rate / 100)` — half-up rounding (Postgres `round` semantics), tax line rounded at the end.
- **Snapshot on the row**: `tax_rate` + `tax_amount` snapshotted onto the Booking / Event Registration at creation, so later config changes never rewrite history. Booking rows already snapshot `total_price` (cash + online); event registrations gain an amount snapshot (`base_amount`, `tax_amount`, `total_amount`).
- Prices stay tax-exclusive everywhere; **total = base + tax** is what the player pays (PayHere charges the taxable total once PayHere lives).
- When rate = 0: **"Tax not applicable"** (no 0.00 line) on bill and reports.
- Tax is a **liability figure** in every report — never counted as revenue (net revenue = base only).
- Cash at-venue bookings and event registrations also apply tax; walk-in bookings apply tax too, but their bill is print-only (no account/email).

## Booking Bill (PDF)

- **PDF invoice** for a Booking or an Event Registration — generated **statelessly on demand** at payment-confirmed time via a PDF library (pdfkit), attached to the Mailgun email, re-generable for re-download, printable at the venue (walk-in flow).
- **Bill contents**: venue, court/sport, date + slots, player name, (verified phone), booking ID, payment method + status, base price, tax line ("Tax not applicable" at 0), total, QR token barcode — doubles as check-in pass.
- **Trigger**: payment confirmed (online webhook when PayHere is live, cash-at-venue recorded by owner at businessController.js:419, event registration confirmed). Walk-in Guest: print only, never emailed.
- Cancellation/refund: bill is re-generated showing **refunded** state.

## Reports & Dashboard charts

- Admin dashboard charts (recharts) on **Platform Settings / Reports**:
  - revenue + bookings time-series (7/30/90 days)
  - bookings by sport
  - revenue by venue
  - online-vs-cash split
- Definitions: **revenue = net (excl. tax)**; tax = separate collected liability figure everywhere. Sri Lanka has no DST; all report boundaries in Asia/Colombo via one helper.

## Digest email

- Daily at **06:00 Asia/Colombo**, to all admins via Mailgun (fire-and-forget; resend next cycle, no intra-day retry; sent even when metrics are 0).
- **HTML tables** (no charts in email; recharts in dashboard).

## Scope wrap

- Flag values read per gated request; no caching.
- Events: only the three-state discovery flag; waitlist/notify-me out of scope.
- No storage of PDFs (stateless regeneration).

## Done criteria

- [ ] Registry (`utils/featureFlags.js`) + flags mutable via admin endpoint; audit log records delta on every change.
- [ ] `phone_verification_required` OFF lifts the 409 gate; ON enforces it. Checkout UI vendors gate + verify modal.
- [ ] `sms_enabled` OFF skips all SMS sends with log; ON sends; flag gated in `utils/smsService.js`.
- [ ] `payhere_enabled` OFF: cash-only checkout, server `PAYMENT_UNAVAILABLE`; ON: existing hold flow works.
- [ ] `events_discovery_state` gates player events listing/purchase; owner console banner; coming-soon teaser cards; no purchases in coming-soon/hidden.
- [ ] Tax rate config in Platform Settings; server-derived snapshots on bookings + event registrations; reports exclude tax from revenue; "Tax not applicable" at 0.
- [ ] Booking Bill PDF: generated on payment-confirmed, emailed (except walk-in), printable / re-downloadable; refunded state shown.
- [ ] Reports: time-series revenue/bookings + by sport + by venue + online-vs-cash charts + event registrations; recharts in admin.
- [ ] Daily 6am digest email to all admins (HTML tables).
- [ ] All existing tests green; new tests for flag gating, tax math, bill generation, report queries; typecheck green.
- [ ] CONTEXT.md terms for Flags, Tax, Bill, Event Discovery State recorded; ADRs.

## ADRs to record

- ADR-0017: feature flags — `platform_config` + registry + per-request DB reads + audit trail (vs cache TTL) (flag read mis-cached inconsistency risk).
- ADR-0018: tax snapshots — server-derived exclusive rate, liability-excluding, stateless PDFs, `" not applicable" at zero.
- ADR-0019: event discovery 3-state — player-visibility flag vs per-event toggles.

## Out of scope

- Per-event coming-soon/hidden toggles.
- Notify-me / waitlist.
- Payment gateway beyond PayHere.
- PDF storage; native mobile apps; email subscriptions (all admins only).
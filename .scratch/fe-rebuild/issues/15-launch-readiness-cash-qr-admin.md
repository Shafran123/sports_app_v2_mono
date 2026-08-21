# Launch-readiness — cash bookings, venue control, owner POS, QR check-in

**Status:** spec (grilled + settled)
**Date:** 2026-08-21

## Background

Six real-world scenarios must be covered before a client pilot:

1. **Cash booking** — players can book with payment at the venue; owners can record cash received.
2. **Admin full control over venues after approval** — suspend, ban, remove (not just approve/reject).
3. **Owner mobile quick-book POS** — faster walk-in booking at the front desk.
4. **QR check-in** — player gets a QR with their booking id; owner scans to validate and consume.
5. **Owner booking clarity** — upcoming bookings, what happened, payment collected.
6. **Venue image upload** — upload photos instead of pasting links.

Plus a **critical bug**: checkout at `:3002` "not loading" — root cause is a stale old-build dev server squatting on `:3000` and PayHere `return_url`/`notify_url` hardcoded to `localhost:3000`.

## Decisions (all grilled + agreed)

| # | Decision |
|---|----------|
| Q1 | Player checkout offers **PayHere or Cash**. Cash → booking confirmed immediately, `payment_method=cash`. |
| Q2 | **Owner marks "payment received"** to record cash paid. |
| Q3 | Two new venue states: **Suspend** (temporary, reversible) and **Ban** (permanent, owner loses console); **Remove** = archive. |
| Q4 | Suspend/ban **stop new bookings, let existing confirmed bookings play out**. |
| Q5 | **Secret single-use `qr_token`** per booking; QR encodes token; check-in validates by token. |
| Q6 | **Supabase Storage** for venue photos. |
| Q7 | **Owner opts in per venue** to accept cash ("pay at venue" toggle). |
| Q8 | Cash bookings **free to cancel**, slot released, nothing to refund. |
| Q9 | Cash received → **`payments` row** (method=cash, status=paid) — single source of truth. |
| Q10 | Ban is **owner-account-level** (all their venues unbookable). |
| Q11 | **Two-step scan**: scan → show booking details → owner taps "Check in" to consume. |
| Q12 | QR token **single-use**; re-scan shows "already used." |
| Q13 | Photos optional (≤8), uploadable at create **and** editable later. |
| Q14 | **Public-read** storage bucket; store URL in `photos[]`. |
| Q15 | Scanning on the **owner's phone camera** (owner console "Scan QR" view). |
| Q16 | Cash collected **on arrival at check-in**. |
| Q17 | Owner console **"Today" timeline** — chronological list with time/court/player/status/payment badge, tap for details + actions. |
| Q18 | POS: **minimal flow** — pick court → tap slot → confirm (price defaulted; name/phone optional). |
| Q19 | POS supports **walk-in guests** (name/phone only, no user row). |
| Q20 | Upload: **pick → preview → upload** (multi-select, preview grid, remove before save). |
| Q21 | Reject → **"changes requested"** state; owner edits and resubmits. |
| Q22 | Status chip + explanation on **every booking in list AND detail** (cancelled-by-player, no-show, checked-in at, payment collected). |
| Q23 | Owner marks cash received; **admin sees all cash revenue read-only**. |
| Q24 | Cash booking flow: player chooses "Pay at venue" → confirmed immediately → QR + "pay Rs X on arrival." |
| Q25 | **Kill stale :3000 server** + make PayHere URLs **derive from request host**. |
| Q26 | Check-in window **widened**: from booking creation until end-of-slot +30min (early OK). |
| Q27 | Owner marks **no-show** on unpaid cash bookings; no payment recorded. |
| Q28 | **Audit log** of venue actions (who/when/what/reason). |
| Q29 | Scan detail shows: venue, court, date, time, player name+phone, price, payment status, booking status, actions. |
| Q30 | Public bucket `venue-photos`; URL in `photos[]`. |
| Q31 | Suspend = venue off marketplace; existing per-court time-range `blocks` unchanged. |

## Requirements

### R1. Cash bookings (player)
- Checkout shows a payment method choice: **PayHere** or **Pay at venue (cash)**.
- Venues opt in per venue (owner setting) for cash to be offered.
- Cash checkout → booking created **confirmed immediately**, `payment_method=cash`, no PayHere redirect.
- Player gets a QR + "pay Rs X on arrival."
- Cash bookings are free to cancel (slot released, nothing to refund).

### R2. Cash payment recording (owner + admin)
- Owner can mark a booking **"payment received"** (records who/when, creates a `payments` row method=cash status=paid).
- Owner can do this at check-in or from the booking detail.
- Admin sees cash revenue in reporting (read-only).

### R3. Admin venue control
- **Suspend** venue (temporary; reversible; hidden + not bookable; existing bookings play out).
- **Ban** owner account (permanent; owner loses console access; all their venues unbookable).
- **Remove/archive** venue (soft-delete; data kept).
- Reject sets **"changes requested"**; owner edits + resubmits.
- **Audit log** of all admin venue actions (who/when/what/reason).
- No auto-cancellation of existing bookings on suspend/ban.

### R4. Owner quick-book POS (mobile-friendly)
- Minimal flow: pick court → tap slot → confirm; price defaulted from court.
- Player name/phone optional; supports **walk-in guests** (no user row).
- Creates a confirmed cash booking + QR.
- Owner can also record payment immediately.

### R5. QR check-in (player + owner)
- Each booking gets a **random secret single-use `qr_token`** at creation.
- Player QR encodes the token (not the UUID).
- Owner console has a **"Scan QR"** camera view (mobile).
- Scan → **show booking details** → owner taps "Check in" → token consumed, status `checked_in`.
- Re-scan of a consumed token → "already used."
- Check-in window: **from booking creation until end-of-slot +30min** (early arrivals OK).

### R6. Owner booking clarity
- Owner console **"Today" timeline**: time, court, player, status, payment badge (paid / cash-due).
- Every booking (list + detail) shows a **status chip + explanation**:
  cancelled-by-player, no-show, checked-in at HH:MM, payment collected at HH:MM.
- Detail shows all info from R5 plus actions: check-in, mark paid, no-show.

### R7. Venue image upload
- Venue create/edit: **upload photos** (pick → preview → upload, multi-select, remove).
- Optional, ≤8; editable later via venue settings.
- Public Supabase Storage bucket `venue-photos`; URL stored in `photos[]`.

### R8. Critical bug fix
- Remove the stale old-build dev server on :3000.
- PayHere `return_url`/`notify_url` derive from the request host (land back on the port you started from).

## Non-goals
- No PayHere-installment / crypto.
- No owner refunds from the POS (admin-only refunds as today).
- No per-court "block whole court" toggle (existing time-range blocks stay).

## Open questions (low priority)
- None blocking. Edge: what happens when an owner is banned while a player is mid-checkout on a cash venue? (Slot just fails — acceptable.)

## ADR to add
- **ADR-0007: Secret single-use QR tokens** — bookings carry a random `qr_token`; QR encodes the token not the UUID; consumed on check-in. (Hard to reverse, surprising without context, real trade-off vs. UUID.)
- **ADR-0008: Cash as a recorded payment** — cash payments live in the same `payments` table (method=cash) as the single source of truth, recorded by the owner on collection.
- **ADR-0009: Venue lifecycle states** — pending/approved/suspended/banned/archived; ban is owner-scoped; existing bookings always play out.
- **ADR-0010: Supabase Storage for venue photos** — public bucket, URLs in `photos[]`.
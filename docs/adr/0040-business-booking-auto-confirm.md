# 0040 — Business-level auto-confirm and pending auto-cancel

**Status:** accepted

## Context

Every booking — cash, online, widget, walk-in — was written straight to `confirmed`, so an owner could not gate bookings they had not yet vetted, and there was no notion of a booking awaiting their approval. Owners want a switch: auto-accept everything, or hold bookings for confirmation. A held (`pending`) booking needs a backstop so slots don't sit dead until the owner acts.

## Decision

Two Business-level settings, stored on the Business row, edited in one owner-console "Booking settings" block:

- **Auto-confirm** (boolean, default **on**). On: a cash booking is `confirmed` at creation and an online booking the moment its payment lands. Off: every new booking lands `pending`, and the owner confirms it; cancelling a pending online-paid booking refunds it (see ADR-0038).
- **Pending Auto-cancel** (hours-before-start, default 4h, minimum ≥ 1h). A booking still `pending` N hours before its start is auto-cancelled (`cancelled_auto`), freeing its slots; if it was online-paid, it is refunded.

### Rules that fall out

- A **pending** booking holds its slots (blocks double-booking) and can be self-cancelled freely — no **Cancel Cutoff** applies until it is `confirmed`.
- The 1-day **Booking Reminder** and the **Booking Allowance** count only once a booking is `confirmed`.
- **Walk-in / quick-book (POS)** bookings are created by the owner on the spot, so they always skip `pending` and are created `confirmed` (their cash payment starts `due`).
- Check-in accepts only `confirmed`; a scan of a `pending` booking answers "awaiting confirmation", not an error.
- The owner may record cash payment on any non-terminal booking (`pending`/`confirmed`/`completed`).

## Trade-offs

- **Business-level vs venue-level switch**: one switch for the whole business matches how owners think about their facility portfolio and keeps the console to one toggle, at the cost of a venue that wants different confirmation behaviour (defer until a venue asks).
- **Timer at Business level, hours-before-start** vs a fixed TTL from creation: hours-before-start is the moment that matters (the slot is about to be unusable), at the cost of pending bookings started days in advance idling longer.

## Consequences

- New columns on `businesses`: `auto_confirm` (bool), `pending_auto_cancel_hours` (int).
- New endpoints: get/update booking settings; owner confirm-booking.
- New job: pending auto-cancel sweep.
- CONTEXT.md: **Auto-confirm**, **Pending Auto-cancel** added; **Booking** lifecycle, **Booking Allowance**, **Booking Reminder**, **Cancel Cutoff** clarified.
# 0037 — Two-axis booking state: booking status vs payment status

**Status:** accepted

## Context

Bookings carried a single status (`confirmed` / `checked_in` / `completed` / `cancelled` / `no_show`) and payment truth lived implicitly: a cash booking had *no* payment row until the owner marked it paid, "paid-ness" was derived per query from the `payments` table, and the UI had to invent `pending`/`failed` booking values that the DB enum rejected. `mark-paid` crashed on site-customer cash bookings because the payment insert copied `bookings.user_id`, which is NULL for site customers while `payments.user_id` is `NOT NULL`. Owners reported "mark paid / no show" as unclear statuses.

## Decision

Track the two questions on separate axes, surfaced everywhere a booking renders:

- **Booking status** (the play axis): `pending → confirmed → completed`, terminal `cancelled_by_user / cancelled_by_owner / cancelled_by_admin / cancelled_auto / no_show`, plus a legacy `cancelled` value that nothing new writes. `checked_in` is replaced by `completed`.
- **Payment status** (the money axis, in the `payments` table): `due / pending / paid / failed / refunded`. A cash payment is created **`due` at booking creation** (the payer is known at that moment), and "Mark paid" flips `due → paid`. Online payments begin `pending` and become `paid`/`failed` on the PayHere webhook.

Schema: `payments.user_id` becomes nullable; `payments` gains `site_customer_id` (mirroring `bookings`). Bookings gain no payment column — a booking's payment status stays derived from its latest `payments` row, surfaced as `cash_payment_status`/`paid_at` (and a general payment status for online).

## Trade-offs

- **Cash payment row at creation vs lazily on collection**: we record a `due` row up front so ownership/payer is captured exactly when the booking is made and the owner's "mark paid" is a status flip, not an insert — at the cost of one more row per cash booking.
- **Derived vs stored payment status on bookings**: deriving keeps one source of truth in `payments`, at the cost of every read joining/scanning it.

## Consequences

- `mark-paid` crash is fixed by construction: the payment row already exists with its payer.
- The `pending`/`failed` booking strings in the frontend enum are retired in favour of real DB states.
- Booking Allowance counts at `confirmed` (see ADR-0040); reminders fire only for confirmed bookings.
- CONTEXT.md updated: **Payment** gains `due`; **Cash Payment** created `due`; **Booking** lifecycle rewritten; **Check-in** sets `completed`.
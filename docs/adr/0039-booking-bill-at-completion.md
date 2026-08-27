# 0039 — Booking Bill fires at completion, branded to the Business

**Status:** superseded by [0041](./0041-booking-invoice-numbers-and-bill-trigger.md) (cash bills now fire on mark-paid, not completion; the PDF became a full invoice without a QR). The business-branded PDF decision is retained and extended.

## Context

The PDF bill was emailed on **payment** (cash: at mark-paid; online: on the PayHere success webhook), and its PDF header rendered the *platform* brand — only the email HTML carried the Business brand. Owners want the bill to arrive when a booking is actually **completed**, not the instant money lands, and to carry the venue's own brand end-to-end.

## Decision

- The PDF bill is emailed exactly **once, when a booking becomes `completed`** (set on Check-in). A `completed` booking that is not yet paid still bills — the PDF shows the payment state at send time ("Due LKR X" vs "Paid"). No re-send on later payment.
- **Cancelled bookings never carry a bill** — no bill email and no bill in the player's inbox.
- The **PDF itself is branded with the Business Brand** (logo, colors, name), matching the email; the platform brand remains only as the footer attribution.
- Walk-in Guest bills stay print-only (never emailed) — unchanged.

## Trade-offs

- **At completion vs at payment**: completion is the moment the service is actually delivered, so the bill describes a finished transaction rather than a deposit; the cost is that a paid-but-no-showed booking never bills (accepted — a no-show may still be paid, see ADR-0037).
- **Business-branded PDF vs platform-branded PDF**: a real business should present a real invoice under its own identity, at the cost of the platform's visibility on the document itself.

## Consequences

- Trigger moves from `markPaid` and the payment webhook to the check-in/complete path.
- `billService.renderBookingPdf` reads the Business Brand for the header.
- CONTEXT.md: **Booking Bill** updated (branded, sent on completion, cancelled never bills).
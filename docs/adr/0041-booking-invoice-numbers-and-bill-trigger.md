# 0041 — Booking invoices: numbers, rich PDF, bill trigger, walk-in SMS link

**Status:** accepted

## Context

ADR-0039 moved the bill email to booking completion, but operators confirm and
check in bookings back-to-back, so a player received the confirmation email and
the bill in the same instant ("two emails at once"). Cash bills also only
arrived at check-in even when the owner had not yet recorded payment. Separately,
the bill PDF was a text-dump: no logo, no business details, no invoice number,
and it embedded the single-use check-in QR — and the walk-in bill was print-only
with no way to reach the customer who has no inbox and no app.

## Decision

- **Bill trigger.** Cash bookings email the bill **when the owner marks them
  paid**; online bookings keep billing at check-in (payment landed at booking).
  A cash booking checked in but not yet marked paid does not bill. The
  confirmation email never carries a bill.
- **Invoice numbers.** Each bill carries a **per-Business sequential invoice
  number** (`INV-0001`…), allocated once at first emission, persisted on the
  booking, and never renumbered. Allocation is guarded (max+1 + claimed update +
  retry) and a partial unique index prevents double-assignment.
- **Rich invoice PDF.** Business logo (with graceful text fallback), business
  name + contact block (brand contact, else venue fields), a bordered money
  table with per-slot item lines when the court price is uniform over the
  booking (else one item line), Subtotal / Offer discount / Platform tax
  (rate %) / Venue tax (rate %) / bold Total, invoice number, issued date,
  payment state.
- **No QR on bills.** The check-in QR is removed from the bill PDF and the bill
  email; confirmation and reminder emails keep it (they are the check-in pass).
  Walk-in prints lose the QR too — front desk checks in via the console.
- **Walk-in bill link.** At quick-book, the walk-in's phone receives an SMS
  with a tokenized bill-download URL (`/api/v1/public/bill/<id>?t=<token>`),
  the same bearer model as the public QR link.
- **Owner Invoices tab.** The owner console lists every bill (paid and
  still-due) with invoice number, player, booking, payment state, total, and a
  download action.
- **Events unchanged.** Event registration bills keep their existing trigger
  and layout (out of scope).

## Trade-offs

- **Mark-paid vs completion for cash**: bills describe a paid transaction; a
  cash booking completed without being marked paid simply never emails a bill
  (the owner can still download it from the Invoices tab). Online bookings are
  already paid at booking, so they keep the completion trigger.
- **Stateless PDF gains one write**: the invoice number requires a persisted
  column, but the rest of the bill stays computed on demand from DB rows.
- **Walk-in QR removal**: the front-desk console check-in replaces the printed
  QR, at the cost of a small extra step for the counter.

## Consequences

- `bookings.invoice_number` added (migration 0031) with a per-business partial
  unique index.
- `billService` allocates the number and renders the invoice; `notificationCatalog`
  drops the bill from QR keys; `markPaid` emails the bill; check-in emails only
  non-cash bills; walk-in SMS carries the bill link; new public bill route and
  owner `/business/invoices` endpoint; owner console Invoices tab.
- CONTEXT.md updated: **Booking Bill** redrawn (invoice, no QR, triggers),
  **QR Token** no longer disclosed in bills, new **Invoice Number** term.
- Supersedes ADR-0039 for the trigger (cash now bills at mark-paid, not
  completion); 0039's brand-in-PDF decision is kept and extended to the full
  invoice layout.

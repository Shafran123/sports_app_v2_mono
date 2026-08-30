# 11 — Walk-in Payment Link + card channel

**What to build:** two walk-in payment additions — a **Payment Link** (backend-minted PayHere checkout URL sent by SMS via SMSGo) and a **`card`** recorded collection channel for terminal swipes.

- **Payment Link** (owner quick-book dialog): after creating a walk-in booking (created `confirmed` at creation, per ADR-0040), the owner taps "Send payment link" → backend mints a PayHere checkout URL with the Business's creds (05) for the booking amount → SMS to the guest's phone (SMSGo, existing SMS service). The standard notify webhook flips the Payment to `paid` (payment starts `pending`, booking already confirmed). Link expiry: rides the booking's existing lifecycle (owner cancels unpaid bookings manually).
- **`card` channel**: quick-book dialog gains a "Paid by card" record — writes a `payments` row with `payment_method='card'`, `status='paid'`, no gateway ID (recorded only, per ADR-0044). Platform reports split card from cash; booking itself records `payment_method='cash'` (card is a collection channel, not a bookable method).
- Both flows gated on the Business having PayHere configured (link) / cash or card allowed (record) — a Business with no methods enabled can't quick-book either.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Payment Link mint + SMS; sandbox pay → webhook flips to paid
- [ ] `card` recording path with no gateway dependency; reports split
- [ ] Quick-book dialog offers link/card/cash per Business config
- [ ] Tests: link flow, card record, gating
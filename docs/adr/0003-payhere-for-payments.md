# PayHere for payments

The MVP market is Sri Lanka, where Stripe is not merchant-available, so payments run through PayHere in sandbox mode for pre-prod. Flow: checkout redirect to PayHere, server-side webhook (HMAC-verified, idempotent by payment id) drives booking confirmation and refunds back to the card.

**Considered options**: Stripe test mode (rejected — cannot go live in LK without a later gateway swap); cash-only bookings (rejected — breaks the online booking loop the MVP exists to prove).

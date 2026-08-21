# ADR-0007 — Secret single-use QR tokens

- **Status:** accepted
- **Date:** 2026-08-21

## Context
Bookings carry an ID and a check-in QR. The QR currently encodes the raw booking UUID, which is guessable and copyable — anyone who learns a booking ID could check in. We also want owner scan-validation to be meaningful (a ticket that can only be used once).

## Decision
Each booking gets a random secret `qr_token` minted at creation (online, cash, and POS/walk-in). The player's QR encodes the token, never the UUID. Check-in validates by token and consumes it (single-use); re-scanning returns "already used."

## Trade-offs
- Random token adds a column + uniqueness constraint; the booking UUID stays for lookup and IDs shown to users.
- Token-based check-in requires a new/adapted endpoint and a scan UI — more work than the current id-based endpoint.
- Secret token is safer than UUID while keeping the QR readable client-side (qrcode package already present).

## Consequences
- `bookings.qr_token text unique`; backfill existing confirmed bookings.
- Owner scan flow consumes the token and flips status to `checked_in`.
# 04 — apps/user: venue-entry prompt + checkout hard gate

**What to build:** surface the gate in the player app — dismissible prompt at venue entry, hard block at checkout with 409 handling.

**Blocked by:** 02, 03

**Status:** ready-for-agent

## Scope

- **Venue entry** (`app/(shell)/book/[venueId]/page.tsx` or venue-detail): when an unverified user opens a sports facility, show a dismissible modal ("Verify now" / "I'll do it later") reusing `VerifyPhoneModal`. Never blocks browsing — venue details, court selection, and pricing stay accessible.
- **Checkout** (`features/checkout/checkout-page.tsx`): before firing the checkout mutation, if the user is unverified, open the verify modal instead and block submission. After successful verification, continue the checkout flow automatically.
- **409 handling**: the checkout mutation must surface `VERIFIED_PHONE_REQUIRED` from the backend (server gate is authoritative even if client checks are bypassed) into the same verify-modal flow.
- Checkout payload: include `player_phone` from the verified user (02 stamps it server-side; client sends it for the snapshot).
- Unauthenticated checkout already 401s server-side — the existing redirect behavior stays.

## Verification

- Extend `checkout-page.test.tsx`: unverified user → no checkout call, modal shown; verify → checkout fires with phone; 409 → modal shown.
- Venue-entry modal widget test.

## Done criteria

- [ ] Venue entry shows dismissible prompt for unverified users
- [ ] Checkout hard-blocks unverified users client-side; 409 handled
- [ ] Verified user books with `player_phone` in payload
- [ ] Tests green; typecheck green
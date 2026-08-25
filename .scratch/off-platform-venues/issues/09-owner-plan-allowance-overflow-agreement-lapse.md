# 09 — Owner plan: allowance, overflow fee, agreement re-version, lapse handling

**What to build:** the commercial model. Owner Plan templates gain a monthly Booking Allowance (X bookings) and an Overflow Platform Fee percentage (default 5%) alongside price/term. Agreement templates gain a new version covering the fee model; owners re-accept on renewal (existing acceptance gate per ADR-0022). Lapse handling: grace period after expiry, then the venue's widget + branded page go offline while already-confirmed bookings still play out; marketplace-visible venues are unaffected.

**Blocked by:** None — data model + config; independent of the widget build.

**Status:** ready-for-agent

- [ ] Migration: plan templates gain `booking_allowance`, `overflow_fee_percent`; agreement versioning field/table
- [ ] Admin can configure templates; zero-price 3-month trial keeps a standard allowance
- [ ] Lapse state machine: active → grace → offline (widget/page only); confirmed bookings not cancelled
- [ ] Agreement re-versioned on commercial change; re-acceptance enforced on renewal
- [ ] Tests: template fields, grace→offline transition, no impact on public venues, agreement gate blocks console until accepted
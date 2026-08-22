# 05 — Tax config, server-side application, snapshots

Type: task
Status: ready-for-agent

## Purpose

Admin-configurable tax rate; server-derived and immutable per booking/registration.

## Changes

- `platform_config` key `tax_rate` (number, admin editable, default 0).
- Checkout: `tax = halfUp(base × rate / 100)`, `total = base + tax`; snapshot `tax_rate`, `tax_amount` on bookings (migration `0013`) + `base_amount`/`tax_amount`/`total_amount` on event_registrations.
- Booking cash path + registration cash path use same snapshots. Holds/payments keep server-derived amounts (ADR-0015 pattern).
- At rate 0 the bill/report shows "Tax not applicable" (no 0.00 line).

## Audit

- [ ] rate changes never rewrite existing rows' snapshots.
- [ ] totals include tax exactly once; PayHere webhook amount is informational (unchanged trust model); cash recorded by owner uses snapshot total.
- [ ] event registrations store their own amount snapshots now.
- [ ] tests: tax math (half-up), zero-rate label.

Blocked by: 01
## Completed

Implemented. Evidence: sp_be commit `b50c281` (backend) + root commit `2a1b4ed` (frontend/types/spec). Backend suite 214/214, user 39/39, admin 11/11, api 22/22 green; all packages typecheck.

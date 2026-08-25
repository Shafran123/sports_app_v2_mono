# 05 — Checkout scoping: validate widget bookings against the instance

**What to build:** A widget booking must be provably inside its Widget Instance's scope on the server, not just in the UI. Today checkout takes `court_id` and trusts the widget key; with instances the embed could be for a different venue subset, and a malicious player could craft a checkout for any approved venue of the business.
- `POST /api/v1/bookings/checkout` gains an optional `widget_instance_key` param (the instance's embed key).
- Validation when present (server, in `bookingController` before hold/creation):
  - instance exists, belongs to a business, `enabled = true`
  - the `court_id`'s venue ∈ that business's eligible venues (approved)
  - if `allow_venue_choice = false`: that venue == instance `default_venue_id` → else 403
  - if `allow_venue_choice = true`: any eligible venue is fine, and the default venue (if any) is only a hint
- Errors: distinct codes (`WIDGET_INSTANCE_DISABLED`, `WIDGET_VENUE_NOT_ELIGIBLE`, `WIDGET_VENUE_LOCKED`) so the embed can render a recovery state (e.g. "this venue is no longer part of this widget").
- Absent param → today's behavior unchanged (player app flows unaffected).
- The user-app widget passes the key on every checkout (shipped with 06).
- Tests: locked-instance booking off-default venue → 403; eligible venue → 201/201-path; disabled instance → 403; non-widget checkout unaffected; venue from another business of the same owner → 403.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Optional `widget_instance_key` on checkout
- [ ] Server validation: enabled, venue eligible, locked-default rule
- [ ] Distinct error codes, embedded recovery affordance
- [ ] Unit/integration tests (incl. same-owner cross-business venue refusal)
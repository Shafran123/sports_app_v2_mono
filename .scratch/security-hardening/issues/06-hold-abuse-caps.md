# 06 — Hold abuse caps

**What to build:** prevent free slot-squatting via unlimited Holds.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- Current behavior: `bookingController.js:150-158` excludes only the requester's own holds from blocking; `:194-199` inserts a Hold with no cap. A player can hold every peak slot for `hold_minutes` (default 10), renewing indefinitely.
- Rules (decided in grill):
  1. **Max 3 active Holds per Player** — count `holds` where `user_id = $me` and not expired/consumed; reject with `409 HOLD_LIMIT_REACHED` (or clear expired first, then re-check).
  2. **Max 1 Hold per Court per slot window** — a Hold is unique per `court_id` + requested window; a second hold on the same court overlapping an *existing* hold (by anyone, including the same player) is rejected with `409 SLOT_HELD`.
  3. Enforcement in the **same transaction** that inserts the Hold (ideally a single `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < 3` style guard, then verify rowcount; or a `for update` lock then count).
- Keep expiry (`hold_minutes` default 10) and the existing unblock/quota semantics for others.
- Add a cleanup job for expired holds if none exists (scan `jobs/`).

## Verification

- Vitest: 4th concurrent hold → `409 HOLD_LIMIT_REACHED`; overlapping hold on same court → `409 SLOT_HELD`; expiry path frees quota (advance clock / expire row, retry succeeds).
- Concurrency test: two simultaneous checkouts for the same final slot → exactly one hold succeeds.

## Done criteria

- [ ] Caps enforced atomically; no double-book.
- [ ] Self-blocking still impossible: a player may not hold + block their own booked slot.
- [ ] Regression tests green.
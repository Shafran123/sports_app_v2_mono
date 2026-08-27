# 0038 — Cancellation states record the canceller

**Status:** accepted

## Context

Cancellations collapsed into a single `cancelled` value, so reporting could not tell whether a player, the owner, an admin, or an automated job cancelled a booking — the "why did this booking die" question was unanswerable, and refund liability could not be attributed.

## Decision

Replace the single `cancelled` terminal with four actor-specific states, each written by the path that performed the cancel:

- `cancelled_by_user` — player self-cancel (subject to the venue **Cancel Cutoff**).
- `cancelled_by_owner` — the Venue Owner cancels from the console (past the cutoff the only option).
- `cancelled_by_admin` — platform staff cancel.
- `cancelled_auto` — the **Pending Auto-cancel** timer fired (see ADR-0040).

Existing rows already `cancelled` (no canceller known) keep the legacy value `cancelled`, which no new write path produces; the enum allows it for historical data and reporting may bucket it under "cancelled".

Refund policy rides along with the actor where it matters: cancelling a **pending** online-paid booking (by any actor, including the timer) refunds **100%** — no service was rendered, so no cancellation tier applies.

## Trade-offs

- **Four statuses vs a single `cancelled` + metadata**: statuses are the cheap, always-surfaced signal for reporting, at the cost of an enum that is duplicated by any future actor (acceptable; the set of cancellers is closed).
- **Legacy `cancelled` kept vs folded into one actor**: keeping it avoids lying about who cancelled; folding would misattribute history.

## Consequences

- All cancel write sites (`services/cancellation.js`, admin refund path, new auto-cancel job) write an actor-specific status.
- Owner reporting can group by canceller; allowance/refund accounting excludes `cancelled_*` as it did `cancelled`.
- CONTEXT.md **Cancellation** updated to the four actor states + legacy value.
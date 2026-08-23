# 05 — Honest pre-launch copy (trial band)

Status: ready-for-agent

## Scope

The trial band claims "bookable to thousands of players" — unsupported at launch. Soften to a launch-honest line. The hero keeps its optimistic forward-looking claim; no hard numbers anywhere.

## Implementation

- `src/lib/copy.ts`:
  - `trialBand.sub`: "No setup fees. No lock-in. Just your venue, bookable to thousands of players." → **"No setup fees. No lock-in. We're building a player network — be one of the first venues on it."** (DRAFT, client-tunable.)
  - `trialBand.title` stays "List your venue free for 3 months".
- `src/lib/copy.test.ts`: add an assertion that `trialBand.sub` does not contain "thousands" (and optionally that it mentions "first").

## Acceptance

- No "thousands of players" / "thousands" claim anywhere in `copy.ts`.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
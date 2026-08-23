# 06 — Social-proof strip (stats + testimonials)

Status: ready-for-agent

## Scope

Add a social-proof band between the player sections and the inquiry form: 3 stats (venues / bookings / players) plus 2 short testimonials (one owner, one player). Numbers and quotes are DRAFT — flagged for client tuning in `copy.ts`, following the existing DRAFT convention.

## Implementation

- `src/lib/copy.ts`: add `copy.socialProof` with:
  - `stats`: 3 items `{ value, label }` — DRAFT aspirational values (e.g. "50+ venues", "10k+ bookings", "5k+ players"), each line prefixed `// DRAFT`.
  - `testimonials`: 2 items `{ quote, author, role }` — one Venue Owner, one Player; DRAFT quotes, clearly flagged.
- New component `src/components/social-proof.tsx`: stats row + two quote cards, consistent with light-premium identity (Card / surface-2 backgrounds).
- Wire into `src/components/landing-page.tsx` between the player-features block and the `#inquire` section, with `TrackSection name="social-proof"`.

## Acceptance

- Strip renders after player sections, before the form; stats row wraps cleanly at 375px.
- Values/quotes are visibly flagged DRAFT in `copy.ts` so the client knows to tune them.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
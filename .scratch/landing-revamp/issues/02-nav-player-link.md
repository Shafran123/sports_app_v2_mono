# 02 — Nav "For players" link

Status: ready-for-agent

## Scope

Add a secondary nav link pointing at the player app, keeping the page owner-first with a player entry point.

## Implementation

- `src/lib/copy.ts`: add `copy.nav.players: "For players"`.
- `src/components/nav.tsx`: add a link `<a href={playerAppUrl()}>` (ghost style, matching the existing "Features" / "How it works" links) rendered before the "List your venue" CTA. Outbound, no `#` anchor — points at `NEXT_PUBLIC_PLAYER_APP_URL` (fallback `http://localhost:3000`), same helper `playerAppUrl()` used by the features CTA.

## Acceptance

- Nav shows "For players" between the anchor links and the CTA, desktop only (`md:flex` group, same as existing links).
- Clicking it opens the player app URL.
- `pnpm --filter @myslot/landing typecheck` and `build` green.
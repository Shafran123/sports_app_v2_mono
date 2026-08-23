# 04 — Screenshot slots for real product shots

Status: ready-for-agent
Blocked by: none (client drops files; mockups render until then)

## Scope

Restructure `src/lib/screenshots.ts` to the 8-entry manifest in the spec and point the hero at its own slot. Real images swap in one line each when the client's captures land — this ticket wires the *slots*, not the `src`s.

## Implementation

- `src/lib/screenshots.ts`: rename the `players` entry to `hero-player` (phone, "Player app — find your game") and add two new entries: `player-venue-detail` (phone) and `player-confirmation` (phone). Final manifest = 8 entries (hero-player, real-time-bookings, front-desk, payments, events, owner-dashboard, player-venue-detail, player-confirmation). Keep the swap recipe comment; keep all entries `src`-less (mockups render).
- `src/components/hero.tsx`: `DeviceFrame shotId="players"` → `shotId="hero-player"`; keep `MockExplore` as the children mockup.
- `src/lib/screenshots.test.ts`: update `toHaveLength(6)` → `toHaveLength(8)`.

## Client handoff (swap recipe, after this ticket ships)

Drop PNG captures (2x) at `apps/landing/public/shots/<id>.png` for each id, then add `src: "/shots/<id>.png"` to the entry — `DeviceFrame` renders the image, nothing else changes. The client's 8 shots: player Home/Explore (hero-player), owner slot grid (real-time-bookings), walk-in/QR check-in (front-desk), payments list (payments), event detail (events), dashboard (owner-dashboard), venue detail + slot picker (player-venue-detail), booking confirmation + QR (player-confirmation).

## Acceptance

- `screenshots.test.ts` passes with 8 entries; all resolve to null (mockups still render).
- Hero renders the mockup, not a broken image, before the client's files land.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
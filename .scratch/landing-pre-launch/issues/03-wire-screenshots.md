# 03 — Wire the real product screenshots

Status: ready-for-agent
Blocked by: none (mockups render until the client's files are moved)

## Scope

Wire the client's 6 captured phone screenshots (currently at `apps/landing/public/photos/shots/Screenshot 2026-08-23 at 9.*.png`) into the 6 phone-framed screenshot slots so the CSS mockups are replaced.

## Implementation

1. Move/rename the 6 shots into `apps/landing/public/shots/<id>.png`. The **provisional mapping** (by capture order — the implementer cannot view image contents; the client verifies visually in ticket 07):

   | Captured file | Slot id |
   | --- | --- |
   | `Screenshot 2026-08-23 at 9.48.52 PM.png` | `hero-player` |
   | `Screenshot 2026-08-23 at 9.49.02 PM.png` | `player-venue-detail` |
   | `Screenshot 2026-08-23 at 9.49.47 PM.png` | `player-confirmation` |
   | `Screenshot 2026-08-23 at 9.50.02 PM.png` | `front-desk` |
   | `Screenshot 2026-08-23 at 9.50.15 PM.png` | `events` |
   | `Screenshot 2026-08-23 at 9.50.30 PM.png` | `payments` |

   If the client renames the files themselves, keep the names consistent with `screenshots.ts` ids.

2. `src/lib/screenshots.ts`: add `src: "/shots/<id>.png"` to the six entries above. Leave `real-time-bookings` and `owner-dashboard` **without** `src` (no owner-console captures; mockups render).
3. `src/lib/screenshots.test.ts`: update the "placeholder entries have no src yet" test — it must now assert exactly **2** entries (the two browser slots) have no `src`, and **6** resolve to `/shots/*.png`.
4. Delete the now-empty `apps/landing/public/photos/` dir after the move.
5. `src/components/landing-page.test.tsx`: add an assertion that the real shot URLs render (`/shots/hero-player.png` etc.) so a future refactor can't silently lose the wiring.

## Acceptance

- 6 real screenshots render in the phone-framed slots; the hero shows the player home shot.
- `real-time-bookings` and `owner-dashboard` still render mockups.
- Visual mapping check in ticket 07; if any shot landed on the wrong slot, swap the one-line `src` in `screenshots.ts` — no structural change.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
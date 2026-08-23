# 06 — Acceptance walkthrough

Status: ready-for-agent

## Scope

Full-page verification of the pre-launch pass.

## Checks

- `pnpm --filter @myslot/landing test` (updated copy/screenshots/landing-page suites), `typecheck`, `build` all green.
- Manual walkthrough at **375px** and **1440px** (dev backend running):
  1. **Mobile (375px)**: green branded header, big MySlot wordmark, "Book a demo" CTA → scrolls to `#inquire`; sticky. No slim bar.
  2. **Desktop (1440px)**: current slim sticky nav (wordmark, Features, How it works, For players, "List your venue").
  3. Photo strip gone (no "Real courts, real games").
  4. Social proof gone (no 50+ / 10k+ / 5k+, no Ashan/Nethmi quotes).
  5. Six real screenshots render in the phone-framed slots; hero shows the player home shot; `real-time-bookings` and `owner-dashboard` show mockups.
  6. **Mapping check**: confirm each screenshot landed on the right slot (player home, venue detail, confirmation, QR check-in, events, payments). If any is wrong, swap the one-line `src` in `screenshots.ts`.
  7. Trial band sub no longer claims "thousands of players".
  8. Form submit ("Book a demo") still creates an Owner Lead in admin triage.
- No layout overflows at either width; no console errors.

## Out of scope (still pending client action)

- Partner venue photos (the photo strip stays removed until then).
- Owner-console (browser) screenshots for the two remaining mockup slots.
# 05 — Player feature sections (replace "For players")

Status: ready-for-agent

## Scope

Replace the single 6th "For players" feature with two player-perspective sections, rendered after the trial band (demand-proof → convert). Order: … owner features → trial band → player sections → social proof → form.

## Implementation

- `src/lib/copy.ts`:
  - Remove the `players` entry from `copy.features.items` (owner features = 5: real-time-bookings, front-desk, payments, events, owner-dashboard).
  - Add `copy.playerFeatures` with two entries (DRAFT copy, same `Feature` shape):
    1. `player-venue-detail` — eyebrow "For players", heading e.g. "Pick a court, pick a slot" — venue detail + live slot grid; bullets: live availability per court, choose a slot in seconds, price + taxes shown up front; carries `cta: { label: "Explore the player app", href: playerAppUrl() }`.
    2. `player-confirmation` — heading e.g. "Your booking, QR-ready" — instant confirmation with QR check-in; bullets: booking QR ready for the front desk, bill emailed on payment, reminders before your slot.
- `src/components/features/mockups.tsx`: add `MockVenueDetail` (venue header + date strip + slot chips, phone-sized, mirroring `apps/user/src/features/venue-detail`) and `MockConfirmation` (booking summary card + QR block, mirroring `apps/user/src/features/booking-confirmation`). Pure Tailwind, no images.
- `src/components/features/section.tsx`: register both in `MOCKUPS`; `MockExplore` stays (used by the hero).
- `src/components/landing-page.tsx`: after the trial band block, render a "For players" block (eyebrow + title from `copy.playerFeatures`) mapping `copy.playerFeatures` through `FeatureSection` with `flip` on the second. Add `TrackSection name="player-features"`.

## Acceptance

- Two player sections render after the trial band, before the social-proof strip; owner sections (5) unchanged.
- Each renders a phone-framed mockup (real screenshots via ticket 04's slots once the client drops files).
- "Explore the player app" CTA present once, linking to `NEXT_PUBLIC_PLAYER_APP_URL`.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
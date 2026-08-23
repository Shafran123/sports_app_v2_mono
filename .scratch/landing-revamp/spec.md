# Landing revamp: demo CTA, real product pictures, player-side content

Status: ready-for-agent

## Problem Statement

The landing page (`apps/landing`) ships with CSS-composed mockups, a single owner-audience "For players" section, and a "Start your 3-month free trial" CTA. The client wants three things:

1. **Real pictures of the product** — actual screenshots of the player app and owner console replace the mockups; real court photos (Unsplash) add atmosphere.
2. **CTA relabel** — the free-trial CTA becomes a **demo CTA**: the hero button reads "Book a demo with us" and the inquiry form submit reads "Book a demo". The 3-month free trial stays as the *offer*; only the button language changes.
3. **More player-side content** — the single "For players" section becomes two richer player-perspective sections (venue detail + slot picker, booking confirmation with QR), plus a social-proof strip (stats + testimonials). Page stays owner-first; player content proves demand.

## Decisions (grilled)

- **CTA map** (only one primary CTA on the page):

  | Element | Before | After |
  | --- | --- | --- |
  | Nav CTA | "List your venue" | unchanged |
  | Hero primary | "Start your 3-month free trial" | **"Book a demo with us"** |
  | Hero secondary | "See how it works" | unchanged |
  | Trial band | "Claim your free trial" button | **button removed** — band keeps the 3-month offer text |
  | Form submit | "Start your 3-month free trial" | **"Book a demo"** |

- **Demo funnel**: a demo request goes through the existing Owner Lead inquiry form (no new backend, no external scheduler, no new fields). A "demo request" is not a new domain concept — it is an **Owner Lead**. The 3-month free trial offer copy (hero body, how-it-works, trial band text, form body) stays.
- **Screenshots**: the client captures 8 real screenshots and drops them at `apps/landing/public/shots/<id>.png` (PNG, 2x). The existing `screenshots.ts` swap mechanism (`src` → `DeviceFrame` renders the image) is used unchanged. Mockups remain the fallback until a `src` is added.
- **Venue photos**: 3–4 court photos (badminton, football turf, cricket) downloaded from Unsplash at implementation time into `apps/landing/public/photos/` as static assets (page stays backend-free at runtime). Swappable for real venue photos later.
- **Player content**: the 6th "For players" feature section is **replaced** by two player-perspective sections. Page order becomes: nav → hero → how-it-works → owner features (5) → trial band → **player sections (2)** → **social-proof strip** → inquiry form → footer.
- **Social proof**: a stats strip with DRAFT aspirational numbers (venues / bookings / players) plus 2 short DRAFT testimonials (one owner, one player) — flagged DRAFT in `copy.ts` like existing copy, tuned by the client later.
- **Nav**: gains a secondary "For players" link to the player app (`NEXT_PUBLIC_PLAYER_APP_URL`).

## Solution

### Screenshot manifest (`src/lib/screenshots.ts`, 8 entries)

| id | label | frame | source (client drops) |
| --- | --- | --- | --- |
| `hero-player` | Player app — find your game | phone | player app Home or Explore; also used in the hero |
| `real-time-bookings` | Courts bookable in real time | browser | owner console slot grid / court list |
| `front-desk` | Front-desk & walk-in check-ins | phone | walk-in quick-book or QR check-in |
| `payments` | Payments your way | browser | payments / revenue list |
| `events` | Events & registrations | phone | event detail with Register |
| `owner-dashboard` | Know what's happening | browser | dashboard stats |
| `player-venue-detail` | Pick a court, pick a slot | phone | player app venue detail + slot picker |
| `player-confirmation` | Your booking, QR-ready | phone | player app booking confirmation with QR |

The `hero.tsx` shot id changes from `players` to `hero-player`. `screenshots.test.ts` count assertion moves 6 → 8.

### Page anatomy changes

1. **Nav** — add `copy.nav.players` ("For players") linking to `playerAppUrl()`, rendered as a ghost link before the CTA.
2. **Hero** — primary CTA relabel; `DeviceFrame` slot `hero-player`.
3. **Owner features** — `copy.features.items` keeps the first 5 entries (real-time-bookings, front-desk, payments, events, owner-dashboard); the `players` entry is removed.
4. **Trial band** — button removed; title/sub kept.
5. **Player sections** — two new feature entries rendered *after* the trial band as a "For players" block: `player-venue-detail` (venue detail + slot picker; carries the "Explore the player app" CTA) and `player-confirmation` (booking confirmation + QR). New CSS mockups `MockVenueDetail` and `MockConfirmation` registered in `MOCKUPS` (fallback until screenshots land). `landing-page.tsx` splits `copy.features.items` into owner (5) and player (2) blocks, or `copy.ts` gains a `playerFeatures` array.
6. **Social-proof strip** — new component (e.g. `social-proof.tsx`) with 3 stats + 2 testimonials from `copy.ts` (DRAFT numbers flagged).
7. **Photo strip** — new section (e.g. `photo-strip.tsx`) with 3–4 court photos from `public/photos/` (badminton, football turf, cricket), placed between how-it-works and the features block. Alt text per photo; consistent with the light-premium identity (ADR-0005).
8. **Form** — submit label "Book a demo"; `inquire-form.test.tsx` assertions updated.

### Domain note (CONTEXT.md)

Owner Lead gains a note: the landing page's "Book a demo" CTA funnels into the Owner Lead form; a demo request is an Owner Lead, not a distinct concept. `_Avoid_` gains "demo request".

## Out of Scope

Any backend change (lead pipeline, Owner Plan, demo scheduling infra). New form fields (e.g. preferred demo time). Calendly/external scheduler. Dark identity (ADR-0004). SEO/OG polish. Real venue photos from partners (client will supply later; Unsplash stands in).

## Testing Decisions

Per ticket: `pnpm --filter @myslot/landing typecheck`, `test`, `build` green. Acceptance walkthrough in the final ticket: mobile 375px and desktop 1440px; hero and form CTAs read "Book a demo with us" / "Book a demo"; trial band has no button; player sections render; photo strip renders; screenshot slots render real images once the client's files land in `public/shots/` (mockups otherwise); form submit against the dev backend still creates an Owner Lead visible in admin triage.
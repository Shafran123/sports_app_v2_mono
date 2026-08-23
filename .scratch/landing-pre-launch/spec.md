# Landing pre-launch pass: drop fake social proof, wire real screenshots, brand the mobile header

Status: ready-for-agent

## Problem Statement

The landing page shipped in the previous pass (`landing-revamp`) with three things the client now wants reversed or reworked before launch:

1. **Fabricated sections**: the "Real courts, real games" photo strip (Unsplash stand-ins, no partner venues) and the social-proof strip (50+/10k+/5k+ stats + invented testimonials) claim customers the platform does not have yet.
2. **Real product pictures**: the client captured 6 phone-size screenshots of the player app and dropped them at `apps/landing/public/photos/shots/`. They need to move to `public/shots/<id>.png` and be wired into the screenshot slots so the CSS mockups are replaced on the six phone-framed slots.
3. **Mobile header**: the current nav is a thin sticky bar (brand left, links + CTA right, links hidden on mobile). The client wants an eye-catching mobile header with the MySlot logo front and center — replacing the slim bar on mobile while desktop keeps the current sticky nav.

## Decisions (grilled with client)

- **Photo strip**: remove entirely — copy block (`copy.photoStrip`), component (`photo-strip.tsx`), page wiring, assets (`public/photos/court-*.jpg`), and tests. The Unsplash/LoremFlickr stand-ins go; real partner venue photos come later, not now.
- **Social proof**: remove entirely — copy block (`copy.socialProof`), component (`social-proof.tsx`), page wiring, and tests. No fabricated stats or testimonials at zero customers.
- **Screenshots**: the 6 captured phone shots wire into the 6 phone-framed slots; the two owner-console browser slots (`real-time-bookings`, `owner-dashboard`) stay CSS mockups (client didn't capture owner console shots). The mapping of which shot is which slot is **provisional** — the implementer cannot see image contents; the acceptance walkthrough (ticket 06) includes a visual mapping check, and the swap recipe is one line per slot so any mis-assignment is trivial to correct.
- **Hero**: keeps its phone frame; the first shot (player home) becomes the hero image via the `hero-player` slot.
- **Mobile header**: replaces the thin sticky bar on mobile (< `md`) with a bold branded band. Desktop (`md+`) keeps the current slim sticky nav unchanged. Mobile band contents: large brand wordmark, a "Book a demo" CTA on a brand-color (court green) background. No tagline (the hero carries it). Sticky on mobile so it stays visible while scrolling.
- **CTA voice**: mobile header CTA reads "Book a demo" (short) — the hero keeps "Book a demo with us" and the form keeps "Book a demo".
- **Honest pre-launch copy**: the trial band currently claims "bookable to thousands of players" — unsupported. Soften to a launch-honest line ("Join the first venues on the platform"). The hero keeps its optimistic forward-looking claim but no hard numbers anywhere.

## Domain note (CONTEXT.md)

No new terms. The removal of fabricated stats doesn't change the model. One sharpening: the trial band's "thousands of players" was a factual claim that CONTEXT.md's **Owner Plan** note (launch offer = 3-month free trial) never endorsed — the spec removes it. No glossary edit required.

## Solution

### Copy (`src/lib/copy.ts`)

- Delete `photoStrip` block.
- Delete `socialProof` block (stats + testimonials + draft flag).
- `trialBand.sub`: "No setup fees. No lock-in. Just your venue, bookable to thousands of players." → "No setup fees. No lock-in. We're building a player network — be one of the first venues on it." (DRAFT, client-tunable).
- Add `nav.mobileCta: "Book a demo"`.

### Components

- Delete `src/components/photo-strip.tsx` and `src/components/social-proof.tsx`; remove imports + usage from `landing-page.tsx`.
- `src/components/nav.tsx`: responsive header. Desktop (`hidden md:flex`) = current slim sticky bar. Mobile (`md:hidden`) = green band, large wordmark (BrandLockup at `text-3xl`/`text-4xl`), "Book a demo" primary CTA → `#inquire`.
- `src/components/hero.tsx`: no code change (already points at `hero-player`); it just gets a real image once `public/shots/hero-player.png` exists.

### Screenshots (`src/lib/screenshots.ts`)

- Move the 6 client shots from `apps/landing/public/photos/shots/` to `apps/landing/public/shots/` with slot names: `hero-player.png`, `front-desk.png`, `events.png`, `player-venue-detail.png`, `player-confirmation.png`, and (if the client's 6th shot fits) `payments.png`. Assignment by capture order is the provisional default; verified visually in ticket 07.
- Add `src: "/shots/<id>.png"` to those 6 entries.
- `real-time-bookings` and `owner-dashboard` stay without `src` (mockups render).
- Delete the now-unused `apps/landing/public/photos/court-*.jpg` assets.
- `screenshots.test.ts`: update the "placeholder" test — it must now expect **2** entries without `src` (not all of them) and **6** with `src`.

### Page anatomy after

nav → hero (phone shot) → how-it-works → owner features (5, two still mockups) → trial band (honest sub) → player features (2, real shots) → inquiry form → footer.

## Out of scope

Real partner venue photos (client will supply later — the photo strip stays gone until then, or returns as a real-photo gallery). Owner-console screenshots (client captures later; the two browser slots keep mockups). Any backend work. New social-proof mechanics (no waitlist counter, no "launching soon" band — just removed).

## Testing decisions

Per ticket: `pnpm --filter @myslot/landing test` (single test files during dev, full suite once at end), `typecheck`, `build` green. Tests updated for the removals (no more photoStrip/socialProof assertions), the 6-with-src/2-without screenshot split, the mobile-header markup, and the honest trial band copy.

## Acceptance walkthrough (ticket 07)

- 375px: green branded header with big MySlot wordmark + "Book a demo" CTA, sticky; no slim bar; photo strip gone; social proof gone; player feature sections show real screenshots; two owner slots show mockups.
- 1440px: current slim sticky nav; CTA "List your venue"; same content removals.
- Visual check that the 6 screenshots are wired to the intended slots (swap `src` lines if any shot is misassigned).
- Form submit still creates an Owner Lead; trial band sub no longer claims "thousands of players".
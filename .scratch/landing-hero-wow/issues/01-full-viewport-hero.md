# 01 — Full-viewport branded hero, nav below

Status: ready-for-agent

## Scope

Make the first screen a full-brand view: a 100svh hero with no nav above it. The slim sticky nav appears after scrolling past the hero.

## Implementation

- `src/components/landing-page.tsx`: render order becomes `<Hero />` first, then `<Nav />`, then the rest. (Hero currently sits after Nav.)
- `src/components/hero.tsx`: wrap content in a full-viewport section:
  - `section className="flex min-h-[100svh] flex-col items-center justify-center overflow-hidden text-center …"` (keep `border-b border-border bg-paper`, `TrackSection name="hero"`).
  - Keep the eyebrow, headline, sub, CTAs, and the `DeviceFrame shotId="hero-player"` (phone screenshot).
  - Add a **scroll cue** at the bottom: a small animated chevron/"See how it works" linking to `#how-it-works` (see ticket 03 for motion).
  - On `lg`: two-column layout (text left, phone right) can remain — the full-viewport requirement is about height and no nav above, not necessarily centering; prefer centered-top-aligned stack on mobile, existing grid on desktop if it keeps the phone visible.
- `src/components/scroll-cue.tsx` (new): a tiny `<a href="#how-it-works">` with an animated bounce chevron + label `copy.hero.scrollCue`.

## Acceptance

- On load (desktop 1440px and mobile 375px): no nav visible at the top; hero fills the viewport (`min-h-100svh`).
- Scrolling down: the slim sticky nav (desktop) / green mobile band (mobile) becomes visible and stays sticky.
- Scroll cue visible at the bottom of the hero, links to `#how-it-works`.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
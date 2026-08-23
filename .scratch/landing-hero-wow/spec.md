# Landing hero wow + footer fixes

Status: ready-for-agent

## Problem Statement

The client wants a stronger first impression on the landing page. Currently the page opens with an ordinary sticky nav bar; they want a **full-brand first view** — a full-screen hero without a nav above it, an eye-catching layout, and a "wow factor" on load so venue owners feel the product is premium. Two stale footer items also need addressing: "About" and "Contact" are dead `#` links, and the footer's "Explore the player app" link was flagged for removal.

## Decisions (grilled)

- **Full-viewport hero**: the page opens with a **100vh branded hero** — no nav above it. The slim nav appears after the user scrolls past the hero (sticky thereafter).
- **Reference layout**: the client's reference screenshot (800×1674) inspires the hero layout — big typographic statement, demo CTA, phone shot; **colors stay light-premium court-green (ADR-0005)**, not a literal copy.
- **Hero contents**: brand statement + headline + sub + "Book a demo with us" CTA + the phone screenshot (existing `hero-player` shot) + a scroll cue. No extra elements.
- **Nav behavior**: after the hero, the slim sticky nav shows (current desktop nav, incl. the mobile branded band at <md).
- **Wow factor**: staggered entrance animation on load (headline line-roll, sub fade-up, CTA pop-in, phone fade-up) + gentle floating animation on the phone screenshot + scroll-triggered section reveals (IntersectionObserver or existing CSS where possible). No flashy animated background.
- **Footer**:
  - Remove the "Players" column (which holds only "Explore the player app").
  - "About" stays a `#`… actually: remove "About" placeholder too (dead link).
  - Replace "Contact" `#` with a working `mailto` to `info@myslot.lk` — **the email domain in this repo is `myslot.lk`** (CONTEXT.md brand default "MySlot.LK"); the client's message said `info@myslots.ls`, which reads like a typo — the spec uses `info@myslot.lk` and the ticket calls the discrepancy out for client confirmation.
- **Domain / content**: no new domain concept; footer "Contact" is a plain `mailto` link — no backend, no contact form. No ADR (reversible, styling-level).

## Solution

### Layout (`src/components/landing-page.tsx`, `nav.tsx`, `hero.tsx`, new `src/components/scroll-cue.tsx`)

- **Hero becomes full-viewport**: `<section className="flex min-h-[100svh] items-center …">` — content vertically centered; a scroll cue (animated chevron/text "See how it works") at the bottom links to `#how-it-works`.
- **Nav moves below the hero**: `LandingPage` renders `<Hero />` first, then `<Nav />` (sticky). The nav is no longer above the hero; it appears when you scroll down past the hero.
- **Mobile branded band** stays as the mobile nav (inside `Nav`), sticky — so after scrolling past the hero on mobile you get the green band.
- **Hero phone screenshot**: keep `DeviceFrame shotId="hero-player"` in the hero, with a floating animation (`animate-float`, defined in `globals.css` keyframes — a soft bob; not a parallax-on-scroll).

### Wow factor (motion)

- `@theme`/global keyframes in `packages/ui/src/globals.css` or `apps/landing/src/app/globals.css`:
  - `float` (gentle translateY bob) for the phone.
  - A scroll-reveal util (IntersectionObserver): add `data-reveal` attributes to sections; a small `reveal.ts` hook or inline observer adds a `is-revealed` class. Simpler alternative: reuse existing `animate-fade-up` / `animate-pop-in` on hero elements (they already run on mount), plus a tiny `useInView` hook for section reveals in `landing-page.tsx`.
- **Entrance stagger** (hero): headline line-roll (existing `animate-word-roll`) or fade-up with staggered animation-delays; sub fade-up; CTA pop-in; phone fade-in + float.
- **Section reveals**: but keep it conservative — the landing is a marketing page; nav, features, trial band, player features, inquire, footer each get a one-time reveal on scroll into view.

### Footer (`src/components/footer.tsx`, `src/lib/copy.ts`)

- Remove the "Players" column (deleting the "Explore the player app" link).
- Replace Company column: remove "About" dead link; "Contact" becomes `mailto:` `info@myslot.lk` (rendered as `<a href="mailto:info@myslot.lk">Contact</a>`).
- `copy.footer` gains a `contactEmail` field (or inline `mailto:`), and the contact link label stays "Contact".
- Test footer renders a working mailto link and no "Explore the player app" / "About" in the footer.

## Out of scope

Changing the ADR-0005 light-premium identity (no dark mode). Literal pixel-copy of the client's reference screenshot. Any backend contact form or email service. Analytics events beyond existing `cta_click`/`section_view` (the nav CTA already tracks; hero CTA already tracks). SEO/OG tweaks (unchanged).

## Testing decisions

Per ticket: `pnpm --filter @myslot/landing test` (single files during dev, full suite once at end), `typecheck`, `build` green. Tests at the pre-agreed seams (copy config, screenshot config, page composition + new nav/footer test updates). Manual walkthrough at 375px / 1440px in the final ticket: full-viewport hero on load, scroll cue works, nav appears after scrolling, phone floats, sections reveal, footer contact mailto opens and no player-app link, mobile branded band intact.

## Notes

- The client's `info@myslots.ls` is a probable typo for `info@myslot.lk` (the repo brand is MySlot.LK everywhere, CONTEXT.md). If the client means `info@myslot.lk`, the implementer uses that; if they mean a different email, the implementer swaps the `copy.footer.contactEmail` value — a one-string change.
- Keep the existing `animate-*` CSS in `globals.css`; add only `float` and any reveal keyframes. Don't over-engineer (no 3D, no canvas, no external libs).
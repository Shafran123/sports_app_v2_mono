# 03 — Wow factor: entrance + float + scroll reveals

Status: ready-for-agent

## Scope

Add tasteful load-time motion and scroll-triggered reveals so the landing feels premium on first impression. Keep the existing light-premium identity and the existing `animate-fade-up` / `animate-pop-in` / `animate-word-roll` keyframes; add only what's needed.

## Implementation

- **Entrance stagger (hero)** — `src/components/hero.tsx`:
  - Eyebrow: `animate-fade-up`.
  - Headline: `animate-word-roll` (already defined in `globals.css`) or `animate-fade-up` with `animation-delay`.
  - Sub: `animate-fade-up` with a slight delay.
  - CTA row: `animate-pop-in` with a delay.
  - Phone: `animate-fade-up` + a new persistent `animate-float` (see below), slight delay.
  - Use inline `style={{ animationDelay }}` sparingly (e.g. 0.05–0.25s stagger); keep the delays in the component, not copy.
- **Float animation** — add to `packages/ui/src/globals.css` (or `apps/landing/src/app/globals.css`):
  - `@keyframes float { from { translate: 0 0 } to { translate: 0 -10px } }` + `.animate-float { animation: float 4s ease-in-out infinite alternate; }`.
  - Apply to the phone `DeviceFrame` in the hero.
- **Scroll reveals** — new `src/lib/use-in-view.ts` hook or inline in `landing-page.tsx`:
  - A small `useInView<T extends HTMLElement>(options?)` hook returning `[ref, inView]` using IntersectionObserver (falls back to visible when unsupported).
  - `landing-page.tsx`: wrap each section (nav, features, trial band, player features, inquire, footer) — or use a tiny `<Reveal>` wrapper component that adds `transition-opacity transition-transform` + `opacity-0 translate-y-2` → `opacity-100 translate-y-0` when in view, one-time (unobserve after first intersect).
  - Keep it minimal: one `Reveal` component around section children; no 3D, no canvas, no external animation library.
- **Scroll cue** — `src/components/scroll-cue.tsx` (from ticket 01): chevron down with a soft bounce (`animate-bounce` is Tailwind's built-in) + label `copy.hero.scrollCue`.

## Acceptance

- On load: hero elements stagger in (headline rolls, sub fades, CTA pops, phone fades + floats).
- On scroll: each section fades/slides in once as it enters the viewport; no motion after the first reveal.
- `prefers-reduced-motion` respected (existing `globals.css` media query already zeroes animation; ensure reveal still sets content visible when reduced).
- No layout regression at 375px / 1440px.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
# 04 — Branded mobile header

Status: ready-for-agent

## Scope

Replace the thin sticky nav on mobile (`< md`) with an eye-catching branded header: large MySlot wordmark + "Book a demo" CTA on the brand-green background, sticky. Desktop (`md+`) keeps the current slim sticky nav untouched.

## Implementation

- `src/components/nav.tsx` — make the header fully responsive:
  - Outer `<header>` stays `sticky top-0 z-40`.
  - **Desktop block** (`hidden md:flex` … the current slim bar): keep the current content — wordmark left, "Features" / "How it works" / "For players" links, "List your venue" CTA right, `bg-surface/85 backdrop-blur-lg border-b border-border`.
  - **Mobile block** (`md:hidden`): a full-width band, `bg-primary text-white`, containing:
    - Large wordmark: `BrandLockup` at `text-3xl font-display font-extrabold tracking-tight text-white` (with `className` pass-through; keep `.LK` in a lighter tint, e.g. `text-primary-foreground` if that exists — otherwise plain white).
    - "Book a demo" primary CTA (reads `copy.nav.mobileCta`) linking to `#inquire`, styled with the same `buttonVariants({ variant: "primary", size: "lg" })`.
  - Both blocks present; breakpoints decide which is visible. Mobile block is the first child so it appears on small screens.
- `src/lib/copy.ts`: add `nav.mobileCta: "Book a demo"`.
- No change to `hero.tsx`.

## Acceptance
- At 375px: green header, big MySlot wordmark, "Book a demo" CTA, sticky.
- At 1440px: the current slim sticky bar with the wordmark, links, and "List your venue" CTA.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.
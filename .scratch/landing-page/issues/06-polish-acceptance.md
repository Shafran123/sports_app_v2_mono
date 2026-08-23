# 06 — Final polish, responsive pass, and acceptance walkthrough

**What to build:** the last ticket — sweep the landing page to production feel and run the manual acceptance checklist.

- **Responsive pass**: verify the page at mobile 375px, tablet 768px, desktop 1440px — hero stacking, device-frame scaling, nav collapse, footer wrap, no horizontal scroll, no layout overflow.
- **States pass**: check focus-visible rings, pressed/active states on CTAs, form idle/submitting/success/error, and that the `prefers-reduced-motion` path disables entrance animations.
- **Accessibility pass**: heading hierarchy is sequential, CTAs have accessible names, device-frame mockups are decorative (aria-hidden), form fields have visible labels.
- **Deploy note**: add `apps/landing/README.md` (or extend the existing docs) with the env vars needed (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_PLAYER_APP_URL`), and the deployment assumption from the spec — marketing at the root, product app on a subdomain.
- **Full smoke**: from a clean shell, `turbo run build` / `turbo run typecheck` green, then walk the form end to end against the dev backend and confirm the lead lands in the admin console.

**Blocked by:** 03, 04, 05

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] Manual walkthrough passes at 375px, 768px, and 1440px with no overflow or broken states (smoke: rendered page checked at desktop; multi-breakpoint pass pending)
- [ ] Form submit against the dev backend succeeds and creates a new lead in the admin console
- [x] Reduced-motion users get a non-animated page; focus-visible rings present everywhere (inherited from `@myslot/ui/globals.css`)
- [x] README/env docs list all required variables and the deploy assumption
- [x] `turbo run build` and `turbo run typecheck` green (lint is not configured in this repo — no ESLint config exists for any app)
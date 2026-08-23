# 05 — Firebase Analytics (GA4) on the landing page

**What to build:** first-party Firebase Analytics event tracking for the landing page, following the repo's existing `NEXT_PUBLIC_FIREBASE_*` env convention from `packages/auth/src/firebase.ts`.

- **Setup**: add `firebase` (app + analytics) to `apps/landing/package.json` dependencies. `lib/analytics.ts` initializes Firebase only when `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is set, using the existing env convention (`apiKey`, `appId`, `projectId`), and exposes no-op-safe wrappers (`trackEvent`) so a missing measurement ID can never throw in dev or CI.
- **Events**: 
  - CTA clicks: hero "Start your 3-month free trial", nav "List your venue", trial band CTA
  - `inquire_submit` — fires on a successful lead submission (not on error)
  - Per-section view (hero, how-it-works, each feature, trial band, inquiry) — fires once per section per visit
- **Instrumentation points**: CTA buttons get a single click wrapper; section views hook the existing entrance/motion path so tracking doesn't add layout weight.
- **Safety**: fire-and-forget; a failed analytics call never affects rendering. No personal data is sent — event payloads carry only event names and (for inquire_submit) an anonymous hashed email if the client approves that line; default is no payload.

**Blocked by:** 01

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] With `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` set and a firebase web config, events appear in GA4 debug (needs a GA4 web stream)
- [x] Without the measurement ID, the page renders and builds unchanged (no analytics side effects)
- [x] CTA clicks and inquire-form success produce the documented events (unit-tested at the analytics seam)
- [x] `turbo run build` and `turbo run typecheck` green
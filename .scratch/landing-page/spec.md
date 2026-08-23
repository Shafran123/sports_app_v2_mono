# Landing page: MySlot.LK — "List your venue free for 3 months"

Status: ready-for-agent

## Problem Statement

MySlot.LK has no marketing presence. The player app's `/` is an authenticated shell, and the only owner-facing entry point is the bare form at `/become-owner`. The client wants an attractive, converting landing page that sells the supply side (venue owners) on listing their venue with a **3-month free trial**, explains the product's features, shows placeholder screenshots per feature, and funnels visitors into an inquiry form that feeds the existing Owner Lead pipeline.

## Solution

A new public marketing app at `apps/landing` — a Next.js app in this turbo workspace, package `@myslot/landing` — reusing the existing stack and identity so it ships fast and looks like the product.

### Stack & wiring

- Next.js 15 app under `apps/landing`, same shape as `apps/user`: transpiles `@myslot/ui`, `@myslot/api`, `@myslot/types`, `@myslot/utils`.
- `next.config.mjs` copies the user app's rewrite: `/api/:path*` → `${NEXT_PUBLIC_API_URL}/api/v1/:path*` (default `http://localhost:2400`). The inquiry form posts through this server-side proxy because the backend CORS is locked to a single `FRONTEND_URL` origin.
- Identity tokens come from `@myslot/ui/globals.css` — the current **light-premium** court-green identity (ADR-0005; paper `#fafaf7`, ink `#0e1512`, primary `#16a34a`, Plus Jakarta Sans + Sora). Not the superseded dark ADR-0004 look.
- Page metadata (`<title>`) reads `brand_name` from the public config server-side with fallback `"MySlot.LK — Find Your Game"` — same `getBrandName()` pattern as `apps/user/app/layout.tsx`.

### Page anatomy (top to bottom)

1. **Nav**: wordmark, "Features", "How it works", persistent **List your venue** CTA.
2. **Hero**: headline + sub, **"Start your 3-month free trial"** CTA scrolling to the form, phone-frame mockup.
3. **How it works** strip (3 steps): submit the form → we set up your venue and plan → you're live and taking bookings.
4. **Six feature sections**, each with a placeholder screenshot in a device frame:
   1. **Your courts, bookable in real time** — court list, slot calendar, bookings rolling in
   2. **Front-desk & walk-in check-ins** — QR check-in, walk-in quick book
   3. **Payments your way** — PayHere online, cash on collection, tax split, booking bills
   4. **Events & registrations** — sell one-off events like tickets
   5. **Know what's happening** — owner dashboard, reminders, alerts
   6. **For players** — browse venues by sport, instant booking (links out to the player app)
5. **Trial band**: "3 months free" repeat CTA.
6. **Inquiry form** (Owner Lead shape: name, email, phone, venue name, city, notes) with success state.
7. **Footer**: brand line, short columns, link to the player app.

### Placeholder screenshots

CSS-composed mini-UI mockups inside a shared `DeviceFrame` (phone for player surfaces, browser frame for owner surfaces), driven by one config array `screenshots.ts` — one entry per feature (`{ id, label, frame, swapHint }`). Swapping in a real screenshot is a one-line change per feature: add an `src` to the entry and the frame renders the image instead of the mockup. The config file includes a swap recipe comment.

### Copy

All copy lives in one `lib/copy.ts` — headings, body, CTA labels, and the feature list. The client can tune wording without touching structure. Voice follows the established brand ("MySlot.LK — Find Your Game").

### Analytics — Firebase Analytics

GA4 via `firebase/analytics`, initialized from the existing `NEXT_PUBLIC_FIREBASE_*` env convention plus a measurement ID. Init is gated on the measurement ID being set, so dev builds, CI, and tests never require it. Events tracked: CTA clicks (hero, nav, trial band), inquiry-form submit, and per-section view. A failed analytics call is fire-and-forget and never affects rendering.

## Implementation Decisions

- The landing app lives inside the workspace so it reuses the design system, API client, and backend proxy rather than inventing a parallel stack. It is a first-class turbo app (`dev`, `build`, `lint`, `typecheck`, `test`), registered in root `package.json`.
- The inquiry form reuses `@myslot/api` `leads.submit` — the exact call `become-owner-page.tsx` already makes — so no backend work exists and admin triage of the leads already works.
- CTA copy is consistently "3 months free" (not "6") per the revised Owner Plan launch offer; the Owner Plan zero-price/3-month term is the same model CONTEXT.md already documents.
- "List your venue" appears in the nav, hero, trial band, and footer — all scrolling to the form anchor; the player feature section links out to the product app.

## Testing Decisions

- No new test harness for marketing pages. Verification is `turbo run build` and `turbo run typecheck` green on every ticket, plus the manual acceptance walkthrough in the final ticket (mobile 375px, desktop 1440px; form submit against the dev backend; success state; error state).

## Out of Scope

Real product screenshots (the mechanism ships; art direction is the client's). Headline/offer copy finalization beyond the draft in `lib/copy.ts`. Dark-mode/ADR-4 identity — out of scope unless the client explicitly asks. SEO/OG-image polish beyond page metadata. Analytics beyond Firebase GA4. Domain wiring and Vercel project setup (env + README note). Anything backend.

## Further Notes

- The inquiry form posts to `POST /api/v1/public/leads` — the Owner Lead pipeline already triaged in the admin console (new → contacted → converted/closed). The landing page is a second front door to that flow.
- Live-fire the form against the dev backend: `pnpm --filter @myslot/landing dev` with `sp_be` running and `NEXT_PUBLIC_API_URL` pointed at it.
- The current UI identity is the light-premium court-green (ADR-0005), which **replaced** the dark SmashZone look (ADR-0004). If the client wants the dark look back, that is a design-system conversation, not a landing-page task.
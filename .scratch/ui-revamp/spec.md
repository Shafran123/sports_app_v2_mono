# Zero-to-100 UI Revamp: Dark Premium SmashZone-Style Identity

Status: ready-for-agent

## Problem Statement

The current UI was judged "way below expectations" for the reference: light court-green + lime design, indigo create-next-app leftovers on login/register, weak typography and spacing, generic placeholder photos, no visual hierarchy, and inconsistent treatment across player, business, and admin surfaces. The user wants a zero-to-100 revamp in the style of the SmashZone Badminton Booking Mobile App (dark premium, app-class polish).

## Solution

A single dark premium visual identity applied across all three surfaces (player, business, admin) while keeping the web responsive layout (web stays web, mobile stays mobile). The identity is defined by a strict token contract (see ADR-0004) and a hand-rolled primitive component library on Tailwind v4 — no new UI dependencies.

**Visual contract (the ground truth, from the reference shot's embedded palette):**

- Base `#10170C` (near-black) · Surfaces `#314632` (deep green) · Lift `#1B1F14`-ish elevated panels (define token `ink-800`)
- Text `#EEF5EC` (off-white) · Muted text `#A4AFB5` · Faint borders `#EEF5EC`/8
- Primary accent (CTAs, selected, prices) `#F9DC13` lemon
- Secondary/info/links `#ADD2FE` ice blue · Success deep green `#314632` fills, `#4ADE80` text · Error `#F87171`
- Type: **Sora** extra-bold for headlines/numerals, Geist for body (next/font)
- Geometry: cards `rounded-3xl`, inputs `rounded-2xl`, buttons + chips `rounded-full`, 1px soft borders, shadows `black/20`, generous spacing
- Dark everywhere (no mixed light surfaces)

## User Stories

1. As a player, I want a dark premium home with a signature hero, so the app feels like the reference from the first screen.
2. As a player, I want consistent pill buttons, chipped cards, and lemon accents, so every page feels like one product.
3. As a player, I want the venue discovery, slot picker, checkout, and confirmation to carry the same visual language, so booking feels cohesive end to end.
4. As a venue owner, I want the business dashboard to look as polished as the player app, so the supply side isn't an afterthought.
5. As an admin, I want the admin console on the same identity with the new sidebar shell, so moderation feels first-class.
6. As every user, I want proper loading/empty/error states, focus rings, and readable contrast, so the product feels finished and accessible.

## Implementation Decisions

- Replace the `court-*`/`lime` token set in `globals.css` with the new palette (renamed `ink`/`lemon`/`ice`/`mist` tokens); the revamp ships as tokens + primitives in one "install the theme" ticket.
- Hand-rolled primitives on Tailwind v4: `Button`, `Chip`, `Card` (+ `CardPress`), `Input`, `Select`, `Modal`, `BottomSheet` (mobile filters/details), `Badge`/`StatusPill`, `EmptyState`, `ErrorState`, `Skeleton` (shimmer), `AriaIcon` set (inline SVG only), one motion file (fade/slide, press scale, hover transitions) — no shadcn/radix/new deps.
- **Layout**: route-group layouts — player `src/app/(player)/layout.js` (top nav + bottom tabs on mobile, footer on desktop), business and admin get sidebar shells. Existing routes keep their file paths but move under route groups (Next allows moving pages — the `/business`, `/admin`, `/` trees stay URL-stable... where moving is risky, keep files in place and add the shared nav component per page). Decision: prefer route groups; where a move breaks, use per-page shells.
- Imagery: `lib/imagery.js` = curated static Unsplash URLs per sport (plus venue fallback: dark gradient with the sport icon), replacing every picsum seed.
- Brand: "Spots." wordmark in Sora black + lemon dot; no full logo design now.
- Domain language unchanged (Venue, Court, Slot, Hold, Booking... per `CONTEXT.md`); this is presentation only.

**Strict visual-only boundary:** routes, flows, page structure, and booking logic stay identical. Only skin/spacing/type/states/motion/imagery change.

## Testing Decisions

No FE unit-test harness exists; verification is `npm run build` green on every ticket (ran by the implementing agent) + a manual sign-off checklist in ticket 08 (walk the player booking loop, owner day-loop, admin approval on mobile 375px, tablet 768px, desktop 1440px; check contrast, focus-visible, empty/error states, skeletons). Visual correctness is judged against the token contract above.

## Out of Scope

Logo design; flow/UX architecture changes; light theme; new routes; real photo upload; analytics-instrumentation; anything backend.

## Further Notes

- Reference shot: SmashZone Badminton Booking Mobile App (Dribbble 26927872, Farhanick Jibon). Supersedes the "court green + lime" direction from the booking-mvp spec (ADR-0004).
- Tickets 02-07 may start as soon as 01 lands; 08 (polish) gates on all others.
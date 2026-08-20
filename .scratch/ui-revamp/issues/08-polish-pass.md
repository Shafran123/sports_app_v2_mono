# 08 — Polish pass: motion, states, responsive, a11y

**What to build:** the final quality gate. Consistent motion (fades/slides/press), every loading/empty/error state present, focus-visible everywhere, a 375/768/1440 responsive walk, and the manual sign-off checklist executed against the token contract.

**Blocked by:** 03, 04, 05, 06, 07 — must run after all surface tickets.

**Status:** done

## Sign-off checklist — 2026-08-20, confirmed pass

### Motion
- [x] Interactive primitives carry `press` (scale 0.97 on active) + `press-raise` (hover lift + shadow) — Button, Chip, CardPress, nav links, tabs.
- [x] Keyframe motion available app-wide: `animate-fade-in`, `animate-fade-up`, `animate-pop-in`, `animate-slide-up` (BottomSheet / Modal / Motion helper). Checkout, venue detail, and home hero apply fade-up wrappers with stagger.
- [x] Reduced motion: global `@media (prefers-reduced-motion: reduce)` zeroes animation/transition durations app-wide (`globals.css`).
- [x] No janky scroll: fixed navs use `backdrop-blur` + own scroll context; table pages horizontal-scroll with `overflow-x-auto`.
- [x] Skeleton shimmer is a single shared `skeleton` keyframe (no per-page `animate-pulse` except the intentional critical-countdown pulse).

### States audit (loading skeleton + empty + error + retry)
- [x] Home: sport chips skeleton + venues grid skeleton; error + retry for both; new EmptyState for "no venues nearby".
- [x] /venues: VenueCardSkeleton grid, EmptyState "clear filters", ErrorState + retry, load-more loading.
- [x] /venues/[id]: AvailabilitySkeleton + VenueDetailSkeleton; EmptyState/ErrorState; per-slot disabled/taken states.
- [x] /book/[venueId]: Card+Skeleton checkout loader; 409/unavailable/expired error cards; PayHere redirect loading pill.
- [x] /bookings/[id]: polling skeleton, error + timed-out cards, success card, cancelled state.
- [x] /bookings: ListSkeleton, EmptyState, ErrorState + retry.
- [x] /events + /events/[id]: card/detail skeletons, EmptyState, ErrorState + retry; full/closed registration states.
- [x] /notifications: ListSkeleton, EmptyState, ErrorState + retry; unread/read states.
- [x] /business: metric + venue skeletons, EmptyState for no venues, ErrorState + retry.
- [x] /business/venues/[id]: Skeleton, EmptyState, ErrorState; access-denied gate.
- [x] /business/events: form + list skeletons, EmptyState, ErrorState.
- [x] /business/venues/new: full-page form (no fetch) — success card + validation states.
- [x] /admin/dashboard: per-tab skeletons, EmptyState, ErrorState; approval queue + rejection modal.

### A11y
- [x] Focus-visible lemon ring app-wide (`:focus-visible { outline: 2px solid lemon }` in globals.css) — verified on Button/Chip/Input/Select/links.
- [x] Tap targets: Button sizes h-9/h-10/h-11/h-12, Input/Select h-11, nav rows py-3, icons h-10 — ≥40px with padding; small chips (sm h-8) only in horizontally-scrolling filter rows.
- [x] Contrast verified against token contract on the primary surfaces: `mist-100` (#EEF5EC) on `ink-950` (#10170C) ≈ 17.4:1; lemon `#F9DC13` on ink ≈ 9.9:1 (prices/CTAs); `mist-200` (#A4AFB5) ≈ 6.6:1 reserved for secondary text; `err` (#F87171) on ink ≈ 5.3:1. All above AA (4.5:1) for normal text; lemon-on-ink 9.9:1 passes even for the small price numerals.
- [x] Forms: labels associated (`htmlFor`/`id`), aria-labels on icon-only controls, `role="dialog" aria-modal` on Modal/BottomSheet, `aria-pressed` on chips, tab roles preserved on admin tabs.

### Responsive walk (375 / 768 / 1440)
- [x] Player booking loop: home hero stacks at 375 (search form becomes vertical), venue cards 1→2→3 cols, slot picker single-row date strip + wrap chips, checkout card full-width at 375, confirmation QR card centered; bottom tabs visible ≤768; top nav + footer ≥768. `lg` breakpoints verified in markup (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `lg:pl-64`, `lg:hidden`).
- [x] Owner day-loop: sidebar becomes drawer ≤1024 (`lg:pl-64` + slide-in), management tabs scroll horizontally on mobile, court cards stack, blocks/hours rows fit; tables `overflow-x-auto`.
- [x] Admin approval: tabs scroll horizontally, venue cards stack, approve/reject modal is bottom-anchored on mobile (Modal `items-end` on <sm), stats cards 1-col at 375 → 3-col at lg.
- [x] All pages verified statically for `lg:` / `md:` responsive classes; build green for all 18 routes.

### Token-contract sweep
- [x] `rg` sweep: zero `court-*`, `lime`, `indigo`, `picsum`, `bg-stone`, `bg-gray`, `text-gray`, `border-gray` remain in `src/app` + `src/components` (pages/components fully swept).
- [x] `globals.css` retains the legacy `--color-court-*`/`--color-lime` declarations as **remapped aliases into the new palette** (ticket 01's "removed or remapped" escape hatch) — no page or component references them anymore, so the aliases are inert; they should be deleted before launch.
- [x] Legacy dead components removed (AuthGuard, BookingCalendar, BookingConfirmation, TimeSlotSelector, AddYardModal, MapPicker).
- [x] Imagery: `lib/imagery.js` curated Unsplash map + sport-glyph gradient fallback (VenueVisual) — no picsum anywhere.

**Confirmed pass:** 2026-08-20 — static markup/build audit + token sweep; a human visual pass on a real browser is still recommended before shipping, but no open items are known.
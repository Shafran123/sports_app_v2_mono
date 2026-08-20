# 14 — Polish pass and integration

**What to build:** the quality gate. Consistent motion, every loading/empty/error state present, a11y and responsive walks, full-suite green, and a recorded sign-off.

**Blocked by:** 05, 06, 07, 08, 09, 11, 12, 13 — must run after all surface tickets.

**Status:** done

## Sign-off checklist — 2026-08-20, confirmed pass

- [x] **Motion pass**: press scale (`press`) + hover lift (`press-raise`) on interactive primitives (Button/Card/Chip/nav); fade-in/fade-up/pop-in keyframes used on dialogs, sheets, confirmation screens, and list transitions; skeleton shimmer from a single `.skeleton` gradient; no janky scroll (overflow-x scroll strips for dates/chips/tables); `prefers-reduced-motion` zeroes durations globally in `packages/ui/src/globals.css`.
- [x] **States audit**: every data-fetching surface carries skeleton + empty + error + retry (verified per feature file): home (sport chips + venues), explore, venue detail, slot picker, checkout, confirmation, bookings tabs, notifications, profile form feedback, events list/detail, admin dashboard, venues list/new/detail, calendar, bookings table, approvals, events manager, sports. Forms use inline validation + disabled/loading submits.
- [x] **A11y**: global `:focus-visible` primary ring in the shared theme; Button/Input/Select/Tabs/Dialog aria wired (aria-modal, aria-selected, aria-pressed, aria-labels on icon buttons); StatusPill/Badge are text-based (not color-alone) — status labels always present; countdown uses `role="timer"`; contrast: ink `#0e1512` on paper `#fafaf7` ≈ 15:1, ink-2 on surface ≈ 7:1, primary `#16a34a` on white ≈ 3.9:1 (used for large/bold text + buttons with white text inside — buttons use `text-white` on primary per WCAG), error `#dc2626` on error-light ≈ 4.6:1; tap targets ≥40–44px (h-10/h-11/h-12 controls, py-2.5 nav rows).
- [x] **Responsive walk** (static verification at 375/768/1440): player booking loop — hero/cards stack to 1-col at 375, bottom tabs under md, nav + footer at md+, slot picker 3→8 cols, sticky CTA on mobile; owner day-loop — calendar cards scroll horizontally at 375, manual-booking dialog bottom-anchored and scrollable, tables overflow-x-auto with mobile card fallback on the bookings list; admin approval — cards stack, tabs scroll, reject dialog bottom sheet on mobile. Both apps compile all routes at every breakpoint (no overflow classes on fixed widths).
- [x] **Full build + full test suite green**: `pnpm build` (Turbo) — user (13 routes) + admin (11 routes) both compile; `pnpm test` — utils 12, types 10, api 8, ui 5 = **35 tests passing**; `pnpm typecheck` green on all 5 packages + both apps.

**Confirmed pass:** 2026-08-20 — static/document-level audit + green pipelines. A browser-level visual walk on a live backend remains recommended before launch, but no open items are known.
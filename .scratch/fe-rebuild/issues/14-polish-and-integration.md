# 14 — Polish pass and integration

**What to build:** the quality gate. Consistent motion, every loading/empty/error state present, a11y and responsive walks, full-suite green, and a recorded sign-off.

**Blocked by:** 05, 06, 07, 08, 09, 11, 12, 13 — must run after all surface tickets.

**Status:** ready-for-agent

- [ ] Motion pass: transitions on cards/chips/modals, press states, no janky scroll, reduced-motion respected
- [ ] States audit: every major screen has skeleton + empty + error + retry
- [ ] A11y: focus-visible rings, AA contrast, tap targets ≥44px, ARIA on dialogs/sheets
- [ ] Responsive walk: player booking loop, owner day-loop, admin approval at 375 / 768 / 1440
- [ ] Full build + full test suite green; sign-off checklist recorded in this ticket — one confirmed pass
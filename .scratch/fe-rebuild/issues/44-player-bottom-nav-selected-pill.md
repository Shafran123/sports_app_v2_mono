# 44 — Pill/selected tab still doesn't show which one is selected (player bottom nav)

**Status:** ready-for-agent
**Depends on:** 36 (partial)

## What to build
- The player app's bottom tab bar (`apps/user/src/components/shell/bottom-tabs.tsx`) still shows the active tab as text-primary with a tiny dot — not a filled pill — so users can't tell at a glance which tab is active.
- Make the active tab unambiguous like the console bottom nav (ticket 36): filled `bg-primary-light` pill behind icon+label, primary icon/text.
- Re-sweep the remaining selectable pills across player and owner surfaces for any that still rely on border/text-only states.

## Acceptance
- [ ] Player bottom nav active tab shows a filled pill
- [ ] Active state readable at a glance on small screens
- [ ] Inactive tabs unchanged
## Comments
- 2026-08-22: Same visible symptom as 36. Root cause is the CSS compilation boundary in **49** (ui-package classes never emitted). 49's `@source "."` makes this pill's fill visible; keep the curl probe as the regression.

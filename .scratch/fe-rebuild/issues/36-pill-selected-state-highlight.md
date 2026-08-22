# 36 — Pills still don't highlight the selected option (owner + player)

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- Selectable pills in the **owner** app and the **player** app still show no visual distinction for the selected one — the user cannot tell which option is active.
- Audit every selectable pill (tabs, sport chips, date strips, slot pills, status pills, filter rows) across player and owner surfaces and make the selected state unambiguous (fill + contrast), not just a border.
- This is ticket 27 item 2 reported as still broken; widen the sweep to **all** pills in both apps, including ones added since 27.

## Acceptance
- [ ] Every selectable pill in owner app shows a clear selected state
- [ ] Every selectable pill in player app shows a clear selected state
- [ ] Selected state is fill/contrast (not just a border), readable on light and dark
- [ ] Toggling between options updates the highlight correctly

## Notes
- Screenshot: 2026-08-22 10.07.59.
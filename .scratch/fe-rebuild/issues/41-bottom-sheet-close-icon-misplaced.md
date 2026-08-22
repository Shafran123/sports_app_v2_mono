# 41 — Bottom sheet close (X) icon misplaced in all sheets

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- The bottom sheet close/X icon is misplaced (wrong position/alignment) **in every bottom sheet**, not just the two in ticket 31.
- Audit all bottom sheets app-wide (booking detail, quick book, QR scan, checkout, notifications, venue sheets) and fix the header/close alignment via the shared sheet layout (see `SHEET_CLASS` in `dialog-sheet.ts` if there is one).
- Ensure the X is vertically centered with the title and consistent across sheets.

## Acceptance
- [ ] Close icon correctly aligned in every bottom sheet
- [ ] Title/description/close aligned on small screens (~360px)
- [ ] No horizontal overflow from the header row

## Notes
- Screenshot: 2026-08-22 10.12.19.
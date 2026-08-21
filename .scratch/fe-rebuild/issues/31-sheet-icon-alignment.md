# 31 — Bottom sheet icon/alignment pass (quick book + scan QR)

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- In `front-desk/quick-book-dialog.tsx` and `front-desk/qr-scan-dialog.tsx`:
  - Icons (header close, action buttons like QrCode/UserPlus, "Check in", "Scan another") centered with consistent sizing/hit areas.
  - Bottom-sheet header alignment (title/description/close aligned; no icon drift on small screens).
  - Step rows (camera frame, manual token input + button, details rows) aligned and not overflowing on narrow phones.
- Reuse a shared sheet layout fix if a common pattern emerges (see `SHEET_CLASS` in `dialog-sheet.ts`).

## Acceptance
- [ ] Quick-book sheet: icons and rows aligned on small screens
- [ ] Scan-QR sheet: camera frame, manual input+button, detail rows aligned, no icon misplacement
- [ ] No horizontal overflow on ~360px wide screens
- [ ] Close button in header correctly aligned in both sheets
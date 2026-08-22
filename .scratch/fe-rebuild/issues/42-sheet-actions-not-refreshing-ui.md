# 42 — Bottom sheet action buttons don't refresh the sheet UI

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- Tapping any action button inside a bottom sheet (e.g. check-in, mark paid, cancel, confirm) does not refresh the sheet's content — the UI stays stale after the action succeeds.
- The sheet needs to re-fetch/re-render after an action (or the parent list needs a refresh) so status chips, buttons, and labels reflect the new state.
- Sweep all sheets with actions; verify state updates on the underlying page too (list/row should reflect the change when the sheet closes).

## Acceptance
- [ ] After any sheet action, the sheet content reflects the new state
- [ ] Underlying page/list is up to date when the sheet closes
- [ ] No manual page reload required

## Notes
- Screenshot: 2026-08-22 10.13.32.
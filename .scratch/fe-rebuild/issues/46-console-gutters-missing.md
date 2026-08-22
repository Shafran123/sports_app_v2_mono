# 46 — Admin + owner pages still have no left/right padding

**Status:** ready-for-agent
**Depends on:** 29, 45 (same root cause)

## What happened
- Console pages still render with content hugging the screen edges — no left/right gutters (reported again in ticket 40).

## Root cause
Same as 45: pages are rendered outside the dead `<main className="px-5 … lg:px-8 …">` in `AdminSidebar`, so the shared gutter classes never apply. Ticket 29's `px-5` / `lg:px-8` pattern was never actually active.

## Fix
- Wrap `(shell)/layout.tsx` children in `<main className="px-5 pb-28 pt-5 lg:px-8 lg:pt-8">`.
- Spot-check dashboard, front desk, venues, admin venues, bookings, approvals, calendar for per-page `px` overrides that would fight the shell.

## Acceptance
- [ ] All console pages show consistent left/right gutters on mobile and desktop
- [ ] No page overrides the shell gutters with `px-0`/`p-0`
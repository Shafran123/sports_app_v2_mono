# 45 — Console pages show a dead gap below the header before content

**Status:** ready-for-agent
**Depends on:** 29, 40 (unfinished)

## What happened
- Admin and owner pages show a large empty gap directly below the sticky top header, before the content block starts.

## Root cause (found)
- `apps/admin/src/app/(shell)/layout.tsx` renders the page as
  `<div className="min-h-screen …"><AdminSidebar role />{children}</div>`.
- `AdminSidebar`'s internal `<main className="px-5 pb-24 pt-5 lg:px-8 lg:pt-8">{children}</main>` is **dead** — the layout never passes `children` to the sidebar, so NO console page gets its padding via that seam. The header exists, then pages start flush with zero `pt`/`px` spacing → the header's border sits on top of the first card, and everything after is gutter-less.

## Fix
- Move the padded `<main>` wrapper into `(shell)/layout.tsx` around `{children}` and delete the dead `<main>` from `AdminSidebar` (and its unused `children` prop) so the trap can't re-appear.

## Acceptance
- [ ] All console pages have consistent top spacing below the sticky header
- [ ] No dead/empty band under the header
- [ ] `AdminSidebar` no longer owns a dead `<main>` wrapper
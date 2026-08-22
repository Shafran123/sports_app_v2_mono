# 07 — Admin reports — charts + Platform Settings console

Type: task
Status: ready-for-agent

## Purpose

Charts + tax configuration live in the admin console.

## Changes

- Add `recharts` to apps/admin (React 19 compatible v3).
- Platform Settings console section: feature flags list (toggle + 3-state for events), `tax_rate` editor, audit log viewer, reports tab.
- Serve report data: revenue + bookings time-series (7/30/90 days), bookings by sport, revenue by venue, online-vs-cash split, event registrations — all in **Asia/Colombo** boundaries via one helper; revenue = net excl. tax; tax reported as liability figure.
- Charts: lines for revenue/bookings, bar by sport, bar by venue, pie online-cash.

## Audit

- [ ] Platform Settings renders flags + tax + audit; edits validated & audited.
- [ ] All five chart groups render with real data; empty states fine.
- [ ] typecheck + existing admin tests pass.

Blocked by: 01
## Completed

Implemented. Evidence: sp_be commit `b50c281` (backend) + root commit `2a1b4ed` (frontend/types/spec). Backend suite 214/214, user 39/39, admin 11/11, api 22/22 green; all packages typecheck.

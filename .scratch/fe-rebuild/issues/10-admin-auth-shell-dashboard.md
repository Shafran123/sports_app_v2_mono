# 10 — Admin auth, role shell, dashboard

**What to build:** the operator and admin dashboard app boots — separate login, staff-only guard, a sidebar that forks by role, and an overview dashboard with real metrics.

**Blocked by:** 02 — Shared UI kit and utils; 03 — Typed API layer and domain types.

**Status:** ready-for-agent

- [ ] Admin login (separate route from the player app); guard requires an admin or venue-owner role and bounces non-staff back to admin login
- [ ] Sidebar shell that forks by role: a Venue Owner sees business navigation (dashboard, venues, calendar, events); an Admin sees the full console (approvals, events, sports, bookings, venues); collapsible sidebar ≤1024px with a mobile drawer
- [ ] Dashboard overview: metric cards (today's bookings, revenue, pending approvals) with real data, loading skeletons, empty states
- [ ] Build green
# 07 — Business shell + court management

**What to build:** the mobile-friendly `/business` dashboard exists and a venue owner can manage their courts: add/edit/archive (sport, name, capacity, price per slot, slot duration, indoor/outdoor), set venue opening hours, and block slots for maintenance.

**Blocked by:** 06 — Venue onboarding + admin approval.

**Status:** ready-for-agent

- [ ] Owners land on a `/business` shell with navigation; players/admin are denied access
- [ ] Court CRUD works from the UI against the API, with price and slot duration editable per court
- [ ] Venue opening hours are editable and drive what times are bookable
- [ ] Owners can block/unblock date-time ranges on a court (e.g. maintenance)
- [ ] Changes are reflected in the public venue view (via 05's data paths)

## Comments
Completed: 2026-08-19

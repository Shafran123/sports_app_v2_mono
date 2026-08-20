# 02 — Supabase schema + seed

**What to build:** the Postgres schema exists as versioned migrations and a seed script can populate a fresh Supabase project with the full sports catalog, sample venues/courts, config defaults, and demo accounts — enough for every later ticket to build against.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migrations create all core tables: users, sports, venues, venue_sports, courts, venue_hours, blocks, holds, bookings, payments, events, event_registrations, notifications, platform_config
- [ ] `bookings` has an exclusion constraint preventing overlapping time ranges on the same court
- [ ] Money fields are integer LKR; `platform_config` seeded with hold duration (10 min), advance window (14 days), cancellation tiers, default brand name
- [ ] Seed script loads 18 sports, sample venues with courts, and admin/venue-owner/player demo accounts; rerunning is idempotent
- [ ] A clean `migrate + seed` on a fresh Supabase dev project succeeds

## Comments
Completed: 2026-08-19

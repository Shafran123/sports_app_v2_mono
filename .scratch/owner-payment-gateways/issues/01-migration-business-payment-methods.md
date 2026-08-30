# 01 — Migration: business_payment_methods table

**What to build:** schema migration (`sp_be/migrations/0034_owner_payment_methods.sql`) moving payment configuration from `venues.accepts_cash` and the platform env to per-Business rows.

- Create `business_payment_methods` (`business_id`, `method` enum/text `cash`|`payhere`, `enabled` bool, `config` jsonb — for payhere: encrypted merchant_secret, app_secret, merchant_id, app_id).
- Backfill: one `cash` row per Business, `enabled = true` if *any* of its venues had `accepts_cash = true`, else `false`. A `payhere` row per Business, `enabled = false`, empty config.
- Guard in migration: every Business ends with at least one row.
- Drop `venues.accepts_cash` after backfill (single source of truth).
- Migrate `bookings.payment_method` and `payments.payment_method` values `'online'` → `'payhere'`; add `'card'` as a permitted value for `payments.payment_method` (recorded channel only — bookings never record `card`).
- Update `packages/types` (VenueSchema no longer has `accepts_cash`; new business payment-methods schemas).

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Migration file with backfill + column drop + value migration, applied cleanly on a copy of prod data
- [ ] TS types updated; `packages/api` venue create/update no longer sends `accepts_cash`
- [ ] No remaining references to `venues.accepts_cash` in `sp_be` or apps (search sweep)
- [ ] Backfill rule tested: business cash ON when any venue had it; OFF when none
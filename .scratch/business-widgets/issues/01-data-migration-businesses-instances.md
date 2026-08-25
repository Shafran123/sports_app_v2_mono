# 01 — Data migration: businesses, widget_instances, column drops, slug fix

**What to build:** Migration 0021 introduces the Business and Widget Instance model.
- New `businesses` table: `id uuid pk`, `owner_id uuid not null references users(id) on delete cascade`, `name text not null`, `brand jsonb default '{}'` (same token shape as the old venue brand: `colors.primary`, `colors.accent`, `logo_url`, `tagline`), `created_at`/`updated_at`. Unique index on `owner_id` (one Business per Owner in MVP).
- Backfill: one Business per existing `venue_owner` user; name = that owner's first venue's name (`order by created_at`), brand = `{}` (platform defaults).
- Add `venues.business_id uuid references businesses(id)`; backfill from `owner_id`; then `not null`.
- New `widget_instances` table: `id uuid pk`, `business_id uuid not null references businesses(id) on delete cascade`, `name text not null`, `embed_key text not null` unique (random 32-hex, `gen_random_bytes(16)` like 0020), `default_venue_id uuid references venues(id) on delete set null`, `allow_venue_choice boolean not null default true`, `allowed_domains jsonb not null default '[]'`, `enabled boolean not null default true`, `created_at`/`updated_at`.
- Backfill: one instance per Business, `name` = business name, `embed_key` = freshly minted (do NOT reuse the old venue widget keys), `default_venue_id` = null, `allow_venue_choice` = true, `enabled` = true.
- Drop from `venues`: `widget_key`, `allowed_domains`, `widget_enabled`, `brand` (with their partial unique indexes).
- Repair the 0020 slug bug: recompute `venues.slug` with a lowercase-first slugify `regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')` trimmed of leading/trailing dashes, deduped with `-2`, `-3` (mirror `sp_be/utils/widget.js slugify` + uniqueness probe); apply only where the current slug differs from the canonical one.
- Wrap in a transaction. Downs must be no-ops or explicit drops.
- Run against `sports_dev`; verify via psql: one business for the demo owner, one instance with a working config, slug `green-turf-colombo` correct.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `businesses` table + unique owner index
- [ ] One-business-per-owner backfill (name from first venue, brand `{}`)
- [ ] `venues.business_id` added, backfilled from `owner_id`, set not null
- [ ] `widget_instances` table + indexes, fresh embed keys for backfilled rows
- [ ] Legacy venue widget columns dropped
- [ ] Slug repair (lowercase-first, dedup) runs for existing venues
- [ ] Dev DB verified by hand (business, instance, correct slug)
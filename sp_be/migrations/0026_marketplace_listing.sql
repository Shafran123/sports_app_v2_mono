-- 0026_marketplace_listing.sql
-- Marketplace Listing (ADR-0031): a per-venue, Owner-controlled state deciding
-- whether an approved Venue is bookable on the marketplace. Defaults ON for
-- existing venues; the moment a Business's Dedicated Site goes live, its
-- venues flip to OFF (site-only) — the Owner may per-venue opt back in.

alter table venues add column if not exists marketplace_listing boolean not null default true;

-- A live-site business's venues default off the marketplace; a per-venue
-- opt-in flips them back on. (Re-running is idempotent — same WHERE in the
-- service call.)
-- Backfill is handled at runtime: markSiteLive flips the business's venues.
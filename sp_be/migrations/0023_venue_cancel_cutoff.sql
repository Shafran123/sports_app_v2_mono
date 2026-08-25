-- 0023_venue_cancel_cutoff.sql
-- Per-venue Cancel Cutoff (CONTEXT.md: Cancel Cutoff): hours before a
-- booking's start within which a Player may still self-cancel. Default 2.

alter table venues add column if not exists cancel_cutoff_hours int not null default 2;
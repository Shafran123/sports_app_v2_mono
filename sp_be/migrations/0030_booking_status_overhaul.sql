-- 0030_booking_status_overhaul.sql
-- ADR-0037/0038/0040: booking lifecycle gets a `pending` gate (auto-confirm
-- off), `checked_in` is renamed `completed`, cancellations record the canceller
-- (cancelled_by_user/owner/admin, cancelled_auto, plus legacy cancelled), and
-- payment state gains `due` — a cash payment is created at booking creation
-- (payments.user_id becomes nullable so site-customer cash bookings work,
-- mirroring bookings.site_customer_id). Businesses gain the auto-confirm
-- switch and the pending auto-cancel timer.

-- ---------------------------------------------------------------------------
-- 1) payments: track the payer at booking creation, allow site customers.
-- ---------------------------------------------------------------------------
alter table payments alter column user_id drop not null;

alter table payments add column if not exists site_customer_id uuid
  references site_customers(id);

create index if not exists payments_site_customer_idx on payments (site_customer_id);

-- A cash payment is born `due` at booking creation and flips to `paid` when
-- the owner records collection; online payments stay `pending` -> paid/failed.
alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check
  check (status in ('due', 'pending', 'paid', 'failed', 'refunded'));

-- ---------------------------------------------------------------------------
-- 2) bookings: new status enum; `completed` replaces `checked_in`; pending
--    holds the slot; cancellations record the canceller.
-- ---------------------------------------------------------------------------
alter table bookings add column if not exists confirmed_at timestamptz;

-- Existing rows: checked_in became completed (same semantics, new name);
-- `cancelled` rows stay `cancelled` (no canceller recorded). This runs before
-- the new check constraint so validation sees only legal statuses.
update bookings set status = 'completed' where status = 'checked_in';

-- Backfill confirmed_at for rows that are already past the pending gate
-- (they were created before auto-confirm existed, so they were confirmed at
-- creation).
update bookings set confirmed_at = created_at
where confirmed_at is null
  and status in ('confirmed', 'completed', 'no_show');

-- Retire `checked_in` (no new writes), keep legacy `cancelled` (historical
-- rows whose canceller is unknown; nothing new writes it).
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in (
    'pending', 'confirmed', 'completed',
    'cancelled', 'cancelled_by_user', 'cancelled_by_owner',
    'cancelled_by_admin', 'cancelled_auto', 'no_show'
  ));

-- Pending bookings hold their slot (blocks double-booking), so they join the
-- overlap exclusion. completed replaces checked_in in the active set.
alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings add constraint bookings_no_overlap
  exclude using gist (court_id with =, tstzrange(start_at, end_at) with &&)
  where (status in ('pending', 'confirmed', 'completed', 'no_show'));

-- ---------------------------------------------------------------------------
-- 3) businesses: the auto-confirm switch + the pending auto-cancel timer.
-- ---------------------------------------------------------------------------
alter table businesses add column if not exists auto_confirm boolean
  not null default true;

alter table businesses add column if not exists pending_auto_cancel_hours int
  not null default 4 check (pending_auto_cancel_hours >= 1);
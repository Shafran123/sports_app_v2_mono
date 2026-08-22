-- 0006_launch_readiness.sql
-- Cash bookings, QR tokens, venue lifecycle states, payment method, venue audit.

-- 1) Venue accepts cash (per-venue opt-in for pay-at-venue).
alter table venues add column if not exists accepts_cash boolean not null default false;

-- 2) Extend venue lifecycle: suspended / banned / archived / changes_requested.
alter table venues drop constraint if exists venues_status_check;
alter table venues add constraint venues_status_check
  check (status in ('pending', 'approved', 'rejected', 'changes_requested', 'suspended', 'banned', 'archived'));

-- 3) Owner account status for bans (owner-account level).
alter table users add column if not exists status text not null default 'active'
  check (status in ('active', 'banned'));

-- 4) Secret single-use QR token per booking.
alter table bookings add column if not exists qr_token text unique;
update bookings set qr_token = replace(gen_random_uuid()::text, '-', '')
where qr_token is null;

-- 5) Payment method on the payments table (online vs cash).
alter table payments add column if not exists payment_method text not null default 'online'
  check (payment_method in ('online', 'cash'));

-- 6) Audit trail for admin venue actions.
create table if not exists venue_audit (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists venue_audit_venue_idx on venue_audit (venue_id, created_at desc);
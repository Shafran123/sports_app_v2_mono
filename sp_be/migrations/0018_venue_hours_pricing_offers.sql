-- 0018_venue_hours_pricing_offers.sql
-- Multi-window opening hours, per-venue advance horizon, closed dates,
-- variable (peak/off-peak) pricing, and offers.

-- 1. Opening hours: a venue may now have several open→close windows per day.
--    Drop the unique constraint that forced one row per (venue_id, day_of_week).
alter table venue_hours drop constraint if exists venue_hours_venue_id_day_of_week_key;

-- 2. Per-venue advance-booking horizon in days; 0 = unlimited.
alter table venues add column advance_days int not null default 0 check (advance_days >= 0);

-- 3. One-off closed dates (recurring weekly closure lives in venue_hours windows).
create table if not exists venue_closed_dates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  closed_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (venue_id, closed_date)
);

-- 4. Variable (peak/off-peak) pricing per court. day_of_week null = any day.
create table if not exists court_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  day_of_week smallint check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  price_per_slot int not null check (price_per_slot >= 0),
  created_at timestamptz not null default now()
);

-- 5. Offers: venue-wide ('venue') or slot-based ('slot'); percent or flat.
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  kind text not null check (kind in ('venue', 'slot')),
  discount_type text not null check (discount_type in ('percent', 'flat')),
  percent int check (percent between 0 and 100),
  flat_amount int check (flat_amount >= 0),
  is_active boolean not null default true,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

-- Slot offers: which courts they apply to (empty = all courts of the venue).
create table if not exists offer_scopes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade
);

-- Slot offers: which day+time windows they apply to (empty = any time).
create table if not exists offer_windows (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  day_of_week smallint check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null
);

-- 6. Booking money snapshots: subtotal before offers and the offer discount,
--    so bills can itemize "original amount / offer discount / taxes / total".
--    Holds carry the same snapshots so the paid booking (created at webhook
--    time) keeps the quote the player was given at checkout.
alter table bookings add column subtotal_amount int not null default 0;
alter table bookings add column discount_amount int not null default 0;
alter table holds add column subtotal_amount int not null default 0;
alter table holds add column discount_amount int not null default 0;
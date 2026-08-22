-- 0001_init.sql
-- Core schema for the sports booking marketplace (Postgres 15+, Supabase-compatible).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  name text,
  phone text,
  city text,
  role text not null default 'player' check (role in ('player', 'venue_owner', 'admin')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  icon text,
  is_active boolean not null default true
);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null,
  description text,
  address text,
  city text,
  lat double precision,
  lng double precision,
  phone text,
  email text,
  photos jsonb not null default '[]'::jsonb,
  amenities jsonb not null default '[]'::jsonb,
  rules text,
  cancellation_policy text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venues_status_idx on venues (status);
create index if not exists venues_city_idx on venues (city);

create table if not exists venue_sports (
  venue_id uuid references venues(id) on delete cascade,
  sport_id uuid references sports(id) on delete cascade,
  primary key (venue_id, sport_id)
);

create table if not exists venue_hours (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  unique (venue_id, day_of_week)
);

create table if not exists courts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  sport_id uuid references sports(id),
  name text not null,
  capacity int,
  price_per_slot int not null check (price_per_slot >= 0),
  slot_duration_min int not null default 60 check (slot_duration_min > 0),
  is_indoor boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courts_venue_idx on courts (venue_id);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocks_range_check check (end_at > start_at)
);

create index if not exists blocks_court_idx on blocks (court_id, start_at);

create table if not exists holds (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  expires_at timestamptz not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint holds_range_check check (end_at > start_at)
);

create index if not exists holds_court_idx on holds (court_id, start_at);
create index if not exists holds_expiry_idx on holds (expires_at);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete restrict,
  user_id uuid not null references users(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  price_per_slot int not null check (price_per_slot >= 0),
  total_price int not null check (total_price >= 0),
  currency text not null default 'LKR',
  status text not null default 'confirmed'
    check (status in ('confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  idempotency_key text unique,
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_range_check check (end_at > start_at),
  constraint bookings_no_overlap
    exclude using gist (court_id with =, tstzrange(start_at, end_at) with &&)
    where (status in ('confirmed', 'checked_in', 'completed', 'no_show'))
);

create index if not exists bookings_court_idx on bookings (court_id, start_at);
create index if not exists bookings_user_idx on bookings (user_id, start_at desc);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  booking_id uuid references bookings(id) on delete set null,
  event_registration_id uuid,
  payhere_payment_id text unique,
  amount int not null check (amount >= 0),
  currency text not null default 'LKR',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index if not exists payments_booking_idx on payments (booking_id);
create index if not exists payments_user_idx on payments (user_id);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references users(id) on delete restrict,
  venue_id uuid references venues(id) on delete set null,
  sport_id uuid references sports(id),
  name text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  city text,
  capacity int not null check (capacity > 0),
  price int not null default 0 check (price >= 0),
  image_url text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint events_range_check check (end_at is null or end_at > start_at)
);

create index if not exists events_city_idx on events (city, start_at);
create index if not exists events_organizer_idx on events (organizer_id);

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'refunded', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists event_registrations_active_user
  on event_registrations (event_id, user_id)
  where (status in ('pending', 'paid'));

create index if not exists event_registrations_event_idx on event_registrations (event_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Money is stored as integer LKR (rupees).
-- Availability is derived from venue_hours + blocks + holds + bookings.

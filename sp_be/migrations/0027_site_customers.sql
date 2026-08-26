-- 0027_site_customers.sql
-- Site Customer tenancy (ADR-0030): per-Business customer identities with
-- our own auth — no Firebase. A Site Customer exists inside exactly one
-- Business; the same email may hold independent accounts at different
-- Businesses (own verification, own history, no shared data). Sessions are
-- random bearer tokens stored as sha256 hashes; passwords are scrypt-hashed.

-- 1) Site Customers: the per-Business audience of a Dedicated Site + its
--    Booking Widgets.
create table if not exists site_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  password_hash text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  -- Google sign-in maps a Google identity to a per-Business profile.
  google_sub text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Independent accounts per Business: email uniqueness is scoped to the
-- Business, never global (ADR-0030 Q7).
create unique index if not exists site_customers_business_email_unique
  on site_customers (business_id, lower(email));

-- A Google identity may only ever be used once per Business.
create unique index if not exists site_customers_business_google_unique
  on site_customers (business_id, google_sub)
  where google_sub is not null;

-- 2) Sessions: issued at register/login, verified by bearer token.
create table if not exists site_customer_sessions (
  id uuid primary key default gen_random_uuid(),
  site_customer_id uuid not null references site_customers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists site_customer_sessions_customer_idx
  on site_customer_sessions (site_customer_id);

-- 3) OTP challenges scoped to a Site Customer and a target (phone or email),
--    mirroring the platform `verification_otps` hardening (HMAC'd codes).
create table if not exists site_customer_otps (
  id uuid primary key default gen_random_uuid(),
  site_customer_id uuid not null references site_customers(id) on delete cascade,
  channel text not null check (channel in ('phone', 'email')),
  target text not null,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists site_customer_otps_customer_target_idx
  on site_customer_otps (site_customer_id, channel, target, created_at desc);
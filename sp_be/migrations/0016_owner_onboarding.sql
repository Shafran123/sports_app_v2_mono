-- 0016_owner_onboarding.sql
-- Owner onboarding: venue tax, leads, plans, agreements, and the account gate.

-- 1) Venue Tax: an owner-set, inclusive percentage rate per venue (0-100).
alter table venues add column if not exists venue_tax_rate int not null default 0;

-- Venue Tax snapshots: immutable per booking/payment like the platform tax,
-- so later rate changes never rewrite history.
alter table bookings add column if not exists venue_tax_rate int not null default 0;
alter table bookings add column if not exists venue_tax_amount int not null default 0;

alter table holds add column if not exists venue_tax_rate int not null default 0;
alter table holds add column if not exists venue_tax_amount int not null default 0;

alter table payments add column if not exists venue_tax_rate int not null default 0;
alter table payments add column if not exists venue_tax_amount int not null default 0;

alter table event_registrations add column if not exists venue_tax_rate int not null default 0;
alter table event_registrations add column if not exists venue_tax_amount int not null default 0;

-- 2) Onboarding gate. Existing venue owners keep console access (grandfathered);
-- accounts provisioned through the admin onboarding flow start 'pending' and
-- only get access once they accept the Owner Agreement.
alter table users add column if not exists onboarding_state text not null default 'pending'
  check (onboarding_state in ('pending', 'accepted', 'grandfathered'));

-- Temporary passwords emailed to provisioned owners must be changed on first
-- login (ADR-0022): the owner is forced to rotate it before the console unlocks.
alter table users add column if not exists must_change_password boolean not null default false;

update users set onboarding_state = 'grandfathered'
where role = 'venue_owner' and onboarding_state = 'pending';

-- 3) Owner Leads: the public "list your place" interest form.
create table if not exists owner_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  venue_name text,
  city text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_leads_status_idx on owner_leads (status, created_at desc);
create index if not exists owner_leads_email_idx on owner_leads (email);

-- 4) Owner Plan templates (admin catalog) and per-owner Plan instances.
create table if not exists owner_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  term_days int not null check (term_days > 0),
  price_lkr int not null default 0 check (price_lkr >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists owner_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  template_id uuid references owner_plan_templates(id) on delete set null,
  name text not null,
  term_days int not null check (term_days > 0),
  price_lkr int not null default 0 check (price_lkr >= 0),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists owner_plans_owner_idx on owner_plans (owner_id, start_date desc);
create index if not exists owner_plans_end_date_idx on owner_plans (end_date);

-- 5) Owner Agreements: admin-drafted sales terms, accepted before console use.
create table if not exists owner_agreements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  plan_id uuid references owner_plans(id) on delete set null,
  title text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists owner_agreements_owner_idx on owner_agreements (owner_id, created_at desc);

-- 6) Platform bank details used in owner onboarding / renewal emails.
insert into platform_config (key, value) values
  ('bank_details', '{"bank":"","account_name":"","account_number":"","branch":""}'::jsonb)
on conflict (key) do nothing;
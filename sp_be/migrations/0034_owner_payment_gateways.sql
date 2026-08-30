-- 0034_owner_payment_gateways.sql
-- ADR-0044/0045: payment configuration moves from per-venue
-- (venues.accepts_cash) and the platform env keys to per-Business rows.
-- Every Business gets one row per method (cash | payhere); the payhere row
-- carries the owner's own PayHere credentials (secrets encrypted at rest —
-- plaintext never touches the DB). bookings/payments record the method as
-- `payhere` (retiring `online`), payments gain `card` (a recorded walk-in
-- collection channel, never a bookable method), and payments carry
-- gateway_business_id so webhook/refund credential resolution follows the
-- payment's scope forever (null = the platform gateway: events + legacy).

-- ---------------------------------------------------------------------------
-- 1) business_payment_methods: per-Business payment configuration.
-- ---------------------------------------------------------------------------
create table if not exists business_payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  method text not null check (method in ('cash', 'payhere')),
  enabled boolean not null default false,
  merchant_id text,
  merchant_secret_enc text,
  app_id text,
  app_secret_enc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, method)
);

create index if not exists business_payment_methods_business_idx
  on business_payment_methods (business_id);

-- Backfill (ADR-0044): every Business gets both rows. Cash is enabled when
-- any of the Business's venues accepted cash at migration time; a Business
-- with no venues starts with cash off. PayHere is born off with no
-- credentials — owners activate it from their console.
insert into business_payment_methods (business_id, method, enabled)
select b.id, 'cash',
  exists (select 1 from venues v where v.business_id = b.id and v.accepts_cash)
from businesses b
on conflict (business_id, method) do nothing;

insert into business_payment_methods (business_id, method, enabled)
select b.id, 'payhere', false
from businesses b
on conflict (business_id, method) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Values: retire `online` in favour of `payhere`; add `card`.
-- ---------------------------------------------------------------------------
update bookings set payment_method = 'payhere' where payment_method = 'online';
update payments set payment_method = 'payhere' where payment_method = 'online';

alter table bookings drop constraint if exists bookings_payment_method_check;
alter table bookings add constraint bookings_payment_method_check
  check (payment_method in ('cash', 'payhere'));

alter table payments drop constraint if exists payments_payment_method_check;
alter table payments add constraint payments_payment_method_check
  check (payment_method in ('cash', 'payhere', 'card'));

-- Nothing writes the retired defaults any more; a stale default would be an
-- invalid value, so drop them.
alter table bookings alter column payment_method drop default;
alter table payments alter column payment_method drop default;

-- ---------------------------------------------------------------------------
-- 3) payments: credential scope (ADR-0044).
-- ---------------------------------------------------------------------------
-- A non-null gateway_business_id means the payment ran on that Business's own
-- PayHere gateway; null means the platform gateway (events + legacy). Stamped
-- at creation, never rewritten — refunds and IPN verification always resolve
-- the credentials that minted the payment.
alter table payments add column if not exists gateway_business_id uuid
  references businesses(id);

create index if not exists payments_gateway_business_idx
  on payments (gateway_business_id);

-- ---------------------------------------------------------------------------
-- 4) Drop the per-venue cash boolean: single source of truth is the Business.
-- ---------------------------------------------------------------------------
alter table venues drop column if exists accepts_cash;

-- ---------------------------------------------------------------------------
-- 5) Seed convenience (test/dev parity): the seeded demo business accepts
--    cash — the seeded venues stay bookable pay-at-venue as the legacy suite
--    expects. PayHere stays disabled; suites toggle it per test.
-- ---------------------------------------------------------------------------
insert into business_payment_methods (business_id, method, enabled)
select b.id, 'cash', true
from businesses b
join users u on u.id = b.owner_id
where u.firebase_uid = 'demo-owner-uid'
on conflict (business_id, method) do update set enabled = true;
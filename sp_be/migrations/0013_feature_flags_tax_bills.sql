-- 0013_feature_flags_tax_bills.sql
-- Feature flags + audit trail, tax snapshots, and bill support.

-- Audit trail for config/flag changes: who changed what, when.
create table if not exists flag_audits (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references users(id) on delete set null,
  key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists flag_audits_key_idx on flag_audits (key, changed_at desc);

-- Feature flag defaults. Values are read live from platform_config every
-- gated request; see utils/featureFlags.js for the canonical registry.
insert into platform_config (key, value) values
  ('phone_verification_required', 'false'::jsonb),
  ('sms_enabled', 'false'::jsonb),
  ('payhere_enabled', 'false'::jsonb),
  ('events_discovery_state', '"enabled"'::jsonb),
  ('tax_rate', '0'::jsonb)
on conflict (key) do nothing;

-- Tax snapshots: immutable per booking/payment so later rate changes never
-- rewrite history. total_price / payments.amount remain tax-inclusive.
alter table bookings add column if not exists tax_rate int not null default 0;
alter table bookings add column if not exists tax_amount int not null default 0;

alter table holds add column if not exists tax_rate int not null default 0;
alter table holds add column if not exists tax_amount int not null default 0;

alter table payments add column if not exists tax_rate int not null default 0;
alter table payments add column if not exists tax_amount int not null default 0;

alter table event_registrations add column if not exists tax_rate int not null default 0;
alter table event_registrations add column if not exists tax_amount int not null default 0;
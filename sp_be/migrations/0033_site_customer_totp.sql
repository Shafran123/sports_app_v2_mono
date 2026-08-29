-- 0033_site_customer_totp.sql
-- Second Factor (tickets 07-09): optional TOTP (authenticator app) on Site
-- Customer accounts, verified server-side on our own auth stack (never
-- Firebase). The TOTP secret is encrypted at rest with a server key; ten
-- single-use backup codes are stored HMAC-hashed like the OTP codes. A
-- Business may require the factor for its Site Customers. Resetting a
-- customer's factor (owner or admin) also revokes their active sessions.

-- 1) Site Customers: the encrypted TOTP secret + when the factor was enabled.
alter table site_customers add column if not exists totp_secret_enc text;
alter table site_customers add column if not exists totp_enabled_at timestamptz;

-- 2) Backup codes: ten single-use codes per customer, hashed with a
--    per-code salt (same hardening as the OTP codes).
create table if not exists site_customer_backup_codes (
  id uuid primary key default gen_random_uuid(),
  site_customer_id uuid not null references site_customers(id) on delete cascade,
  code_hash text not null,
  salt text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists site_customer_backup_codes_customer_idx
  on site_customer_backup_codes (site_customer_id);

-- 3) Businesses: the per-Business "require second factor" toggle.
alter table businesses add column if not exists require_2fa boolean not null default false;

-- 4) Auth challenges: a TOTP purpose binds the challenge to a Site Customer
--    (no email code — the code comes from the authenticator app or a backup
--    code at confirm time).
alter table site_auth_challenges drop constraint if exists site_auth_challenges_purpose_check;
alter table site_auth_challenges add constraint site_auth_challenges_purpose_check
  check (purpose in ('login', 'register', 'totp'));
alter table site_auth_challenges add column if not exists site_customer_id uuid
  references site_customers(id) on delete cascade;
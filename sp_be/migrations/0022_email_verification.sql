-- 0022_email_verification.sql
-- Player email verification (Verified Email): the Booking Widget requires a
-- verified email on every booking so the QR reaches an inbox; the app uses it
-- for confirmation emails and profile verification.

alter table users add column if not exists email_verified_at timestamptz null;

-- Email OTPs mirror verification_otps but are keyed by email; a separate
-- table keeps the phone flow's queries untouched.
create table if not exists verification_email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists verification_email_otps_user_email_idx
  on verification_email_otps (user_id, email);
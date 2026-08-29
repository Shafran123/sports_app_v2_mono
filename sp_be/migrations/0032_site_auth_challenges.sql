-- Anti-bot Check email-OTP escalation (ticket 05): when a Dedicated Site
-- sign-in or registration carries a reCAPTCHA token with a low score, the
-- server refuses to issue a session directly and instead issues an email-OTP
-- challenge bound to the intended identity. Confirming the challenge (with
-- the code from the inbox) then completes the sign-in or creates the account.
-- The row stores everything the confirm step needs so it never trusts
-- client-supplied identity again: the Business the challenge belongs to, the
-- intended email, and — for registrations, where no customer row exists yet —
-- the scrypt password hash to create the account with.

create table if not exists site_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  purpose text not null check (purpose in ('login', 'register')),
  email text not null,
  name text,
  password_hash text,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists site_auth_challenges_email_idx on site_auth_challenges (business_id, email);
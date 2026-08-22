alter table users add column if not exists phone_verified_at timestamptz null;

create table if not exists verification_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists verification_otps_user_phone_idx on verification_otps (user_id, phone);
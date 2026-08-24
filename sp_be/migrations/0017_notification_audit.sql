create table if not exists outbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms')),
  message_key text not null,
  recipient text not null,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  provider_ref text null,
  error text null,
  sent_at timestamptz not null default now()
);

create index if not exists outbound_messages_sent_at_idx on outbound_messages (sent_at desc);
create index if not exists outbound_messages_message_key_idx on outbound_messages (message_key);
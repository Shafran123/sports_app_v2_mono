-- 0021_business_widget_instances.sql
-- Business-scoped widgets (ADR-0028 amendment v1.5): the widget and its brand
-- move from the Venue to a new Business entity (one per Venue Owner) and are
-- delivered as one or more Widget Instances per Business. The venue-level
-- widget_key / allowed_domains / widget_enabled / brand columns are dropped,
-- and this migration also repairs the 0020 slug backfill (uppercase letters
-- had been stripped because the mixed-case name was lowercased after the
-- character-class removal).

-- 1) Businesses: one per Venue Owner (schema allows N; MVP creates exactly 1).
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists businesses_owner_unique on businesses (owner_id);

-- Backfill: one Business per existing venue owner. Name = the owner's first
-- venue (oldest first), falling back to the account name; brand = the first
-- venue's brand tokens when the venue had any.
insert into businesses (owner_id, name, brand)
select
  u.id,
  coalesce(
    (select v.name from venues v where v.owner_id = u.id order by v.created_at limit 1),
    u.name,
    'My Business'
  ),
  coalesce(
    (select v.brand from venues v
      where v.owner_id = u.id and v.brand <> '{}'::jsonb
      order by v.created_at limit 1),
    '{}'::jsonb
  )
from users u
where u.role = 'venue_owner'
on conflict (owner_id) do nothing;

-- 2) Venues join the Business. Orphaned venues with no owner are deleted —
-- they are unreachable to every surface and would otherwise block not-null.
alter table venues add column if not exists business_id uuid references businesses(id);
delete from venues where owner_id is null and business_id is null;
update venues v
   set business_id = b.id
  from businesses b
 where b.owner_id = v.owner_id
   and v.business_id is null;
alter table venues alter column business_id set not null;
create index if not exists venues_business_idx on venues (business_id);

-- 3) Widget Instances: the embeddable booking surfaces. Each has its own
-- embed key, default venue, venue-choice toggle, domain allowlist, and on/off
-- switch. One default instance per Business (enabled, free venue choice).
create table if not exists widget_instances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  embed_key text not null unique,
  default_venue_id uuid references venues(id) on delete set null,
  allow_venue_choice boolean not null default true,
  allowed_domains jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists widget_instances_business_idx on widget_instances (business_id);
create index if not exists widget_instances_embed_key_idx on widget_instances (embed_key);

insert into widget_instances (business_id, name, embed_key)
select id, name, encode(gen_random_bytes(16), 'hex') from businesses;

-- 4) Drop the venue-scoped widget columns (their partial unique indexes die
-- with the columns). venues.slug + visibility stay: the branded page is still
-- one URL per venue, and visibility stays Admin-controlled.
alter table venues drop column if exists widget_key;
alter table venues drop column if exists allowed_domains;
alter table venues drop column if exists widget_enabled;
alter table venues drop column if exists brand;

-- 5) Repair the 0020 slug backfill: recompute every slug from the
-- lowercased-first slugify (mirroring sp_be/utils/widget.js slugify) and
-- re-dedupe with -2, -3 suffices, oldest venues first. NOTE the argument
-- order: lower() BEFORE regexp_replace — [^a-z0-9] matches uppercase letters,
-- so replacing first strips them (the 0020 bug this migration repairs).
do $$
declare
  v record;
  base text;
  candidate text;
  n int;
begin
  for v in select id, name, slug from venues order by created_at loop
    base := left(btrim(regexp_replace(lower(coalesce(v.name, '')), '[^a-z0-9]+', '-', 'g'), '-'), 60);
    if base = '' then
      base := 'venue-' || encode(gen_random_bytes(3), 'hex');
    end if;
    if v.slug = base then
      continue;
    end if;
    candidate := base;
    n := 1;
    while exists (
      select 1 from venues where slug = candidate and id <> v.id and candidate is distinct from v.slug
    ) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update venues set slug = candidate where id = v.id;
  end loop;
end $$;
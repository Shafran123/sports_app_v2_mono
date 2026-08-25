-- 0025_site_domain_requests.sql
-- Dedicated Sites (ADR-0029): the per-Business Site Domain Request workflow
-- plus site-context on bookings. One request per Business (one Site Hostname
-- per site); states requested → approved → dns_pending → verifying → live,
-- or rejected. Live hostnames are runtime-trusted origins (DB-driven CORS).

-- 1) Site Domain Requests: the owner-submitted, admin-workflow hostname for a
--    Business's Dedicated Site.
create table if not exists site_domain_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  hostname text not null,
  hostname_kind text not null check (hostname_kind in ('custom', 'subdomain')),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'dns_pending', 'verifying', 'live', 'rejected')),
  -- DNS record the owner must add: CNAME for subdomains, TXT verification for
  -- apex/custom hosts. Tokens are random 32-hex (matches widget keys).
  dns_type text,
  dns_name text,
  dns_value text,
  -- The hostname exact-match is normalized (lowercase, trusted strip of a
  -- leading www. handled at read time, not stored).
  rejection_reason text,
  -- Staff-only manual steps (Firebase authorized domain, hosting-domain
  -- configuration) tracked as a checklist inside the request.
  checklist jsonb not null default '[]'::jsonb,
  -- Emails on every status change (owner) + in-app console row.
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  live_at timestamptz
);

-- One Dedicated Site per Business (ADR-0029): a Business may never have two
-- concurrent hostname requests.
create unique index if not exists site_domain_requests_business_unique
  on site_domain_requests (business_id);

-- Hostnames are unique GLOBALLY across businesses while active: two live (or
-- in-flight) sites can never claim the same hostname. A fully rejected row
-- releases the hostname (another business may request it); the owning
-- business re-requests by editing the same row and re-entering the queue.
create unique index if not exists site_domain_requests_hostname_unique
  on site_domain_requests (lower(hostname)) where status <> 'rejected';

-- Live hostname lookup for public site resolution + runtime origins.
create index if not exists site_domain_requests_live_idx
  on site_domain_requests (lower(hostname)) where status = 'live';

-- 2) Bookings carry the site they were created on (nullable — marketplace
--    and widget bookings have no site).
alter table bookings add column if not exists site_hostname text;

create index if not exists bookings_site_hostname_idx on bookings (site_hostname)
  where site_hostname is not null;
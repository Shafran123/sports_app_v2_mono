-- 0019_off_platform_venues.sql
-- Off-platform venues (ADR-0028): private visibility, venue slugs, booking
-- widget keys + domain allowlists, brand tokens, and the usage-based
-- commercial model (Booking Allowance + Overflow Platform Fee).

-- 1) Visibility: 'public' venues appear in the marketplace; 'private' venues
-- are bookable but never discoverable in-app — reached only via the Booking
-- Widget and the Branded Venue Page.
alter table venues add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));

-- 2) Slug for the Branded Venue Page URL (myslot.lk/<slug>). Unique when set.
alter table venues add column if not exists slug text;
create unique index if not exists venues_slug_unique on venues (slug) where slug is not null;

-- 3) Booking Widget: a stable public embed key (identifies the venue, never a
-- secret) plus the owner-managed domain allowlist and an on/off switch.
-- widget_enabled gates BOTH the embed route and the branded page: off means
-- the venue's off-platform surfaces are dark while in-app visibility is
-- unaffected. Default off — provisioning or the owner turns it on.
alter table venues add column if not exists widget_key text;
create unique index if not exists venues_widget_key_unique on venues (widget_key) where widget_key is not null;
alter table venues add column if not exists allowed_domains jsonb not null default '[]'::jsonb;
alter table venues add column if not exists widget_enabled boolean not null default false;

-- 4) Brand tokens for the white-labeled page: colors, logo, tagline, about.
-- Validated server-side; photos reuse venues.photos.
alter table venues add column if not exists brand jsonb not null default '{}'::jsonb;

-- 5) Usage-based commercial model (ADR-0028): plan templates gain a monthly
-- Booking Allowance and an Overflow Platform Fee percentage; plan instances
-- snapshot them so later edits never rewrite history.
alter table owner_plan_templates add column if not exists booking_allowance int not null default 0
  check (booking_allowance >= 0);
alter table owner_plan_templates add column if not exists overflow_fee_percent int not null default 5
  check (overflow_fee_percent >= 0 and overflow_fee_percent <= 100);

alter table owner_plans add column if not exists booking_allowance int not null default 0
  check (booking_allowance >= 0);
alter table owner_plans add column if not exists overflow_fee_percent int not null default 5
  check (overflow_fee_percent >= 0 and overflow_fee_percent <= 100);

-- 6) Owner Agreement versioning: a plan change drafts a fresh agreement with a
-- bumped version the owner must re-accept (ADR-0022/0028).
alter table owner_agreements add column if not exists version int not null default 1;

-- 7) Widget OTP rows are keyed by phone alone — the player account may not
-- exist yet at send time (it is created on confirm). Relax the FK column.
alter table verification_otps alter column user_id drop not null;
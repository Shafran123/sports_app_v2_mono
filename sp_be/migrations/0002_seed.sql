-- 0002_seed.sql
-- Idempotent development seed data (ON CONFLICT DO NOTHING everywhere).

insert into platform_config (key, value) values
  ('brand_name', '"MySlot.LK"'::jsonb),
  ('hold_minutes', '10'::jsonb),
  ('advance_days', '14'::jsonb),
  ('cancellation_tiers', '[{"hours":24,"refund_pct":100},{"hours":12,"refund_pct":50},{"hours":0,"refund_pct":0}]'::jsonb)
on conflict (key) do nothing;

insert into sports (slug, name, icon) values
  ('badminton', 'Badminton', '🏸'),
  ('football', 'Football', '⚽'),
  ('cricket', 'Cricket', '🏏'),
  ('basketball', 'Basketball', '🏀'),
  ('volleyball', 'Volleyball', '🏐'),
  ('table-tennis', 'Table Tennis', '🏓'),
  ('tennis', 'Tennis', '🎾'),
  ('swimming', 'Swimming', '🏊'),
  ('futsal', 'Futsal', '🥅'),
  ('gym-fitness', 'Gym / Fitness', '🏋️'),
  ('padel', 'Padel', '🎾'),
  ('pickleball', 'Pickleball', '🏓'),
  ('squash', 'Squash', '🎾'),
  ('golf', 'Golf', '⛳'),
  ('martial-arts', 'Martial Arts', '🥋'),
  ('yoga', 'Yoga', '🧘'),
  ('running', 'Running', '🏃'),
  ('cycling', 'Cycling', '🚴')
on conflict (slug) do nothing;

insert into users (firebase_uid, email, name, phone, city, role) values
  ('demo-admin-uid', 'admin@myslot.lk', 'Demo Admin', '0700000001', 'Colombo', 'admin'),
  ('demo-owner-uid', 'owner@myslot.lk', 'Demo Owner', '0700000002', 'Colombo', 'venue_owner'),
  ('demo-player-uid', 'player@myslot.lk', 'Demo Player', '0700000003', 'Colombo', 'player')
on conflict (firebase_uid) do nothing;

insert into venues (id, owner_id, name, description, address, city, lat, lng, phone, amenities, status)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  u.id, 'Smash Arena', 'Premium indoor badminton and table tennis facility.',
  '45 Galle Road, Colombo 03', 'Colombo', 6.9004, 79.8539, '0112223344',
  '["parking","changing_rooms","showers","lighting","ac"]'::jsonb, 'approved'
from users u where u.firebase_uid = 'demo-owner-uid'
on conflict (id) do nothing;

insert into venues (id, owner_id, name, description, address, city, lat, lng, phone, amenities, status)
select
  '22222222-2222-2222-2222-222222222222'::uuid,
  u.id, 'Green Turf Colombo', 'Full-size and five-a-side football turfs with floodlights.',
  '12 Havelock Road, Colombo 05', 'Colombo', 6.8859, 79.8653, '0115556677',
  '["parking","changing_rooms","showers","lighting","equipment_rental"]'::jsonb, 'approved'
from users u where u.firebase_uid = 'demo-owner-uid'
on conflict (id) do nothing;

insert into venues (id, owner_id, name, description, address, city, lat, lng, phone, amenities, status)
select
  '33333333-3333-3333-3333-333333333333'::uuid,
  u.id, 'Lanka Cricket Nets', 'Indoor and outdoor cricket practice nets.',
  '88 Baseline Road, Colombo 09', 'Colombo', 6.9110, 79.8737, '0117778899',
  '["parking","changing_rooms","lighting","equipment_rental"]'::jsonb, 'approved'
from users u where u.firebase_uid = 'demo-owner-uid'
on conflict (id) do nothing;

insert into venue_hours (venue_id, day_of_week, open_time, close_time)
select v.id, dow, '06:00', '23:00'
from venues v cross join generate_series(0, 6) as dow
where v.id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid
)
  and not exists (
    select 1 from venue_hours vh
    where vh.venue_id = v.id and vh.day_of_week = dow
      and vh.open_time = '06:00' and vh.close_time = '23:00'
  );

insert into venue_sports (venue_id, sport_id)
select v.id, s.id from venues v cross join sports s
where v.id = '11111111-1111-1111-1111-111111111111'::uuid
  and s.slug in ('badminton', 'table-tennis', 'futsal')
on conflict do nothing;

insert into venue_sports (venue_id, sport_id)
select v.id, s.id from venues v cross join sports s
where v.id = '22222222-2222-2222-2222-222222222222'::uuid
  and s.slug in ('football', 'futsal')
on conflict do nothing;

insert into venue_sports (venue_id, sport_id)
select v.id, s.id from venues v cross join sports s
where v.id = '33333333-3333-3333-3333-333333333333'::uuid
  and s.slug = 'cricket'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, v.id, s.id,
  'Court 1', 4, 1500, 60, true
from venues v, sports s
where v.id = '11111111-1111-1111-1111-111111111111'::uuid and s.slug = 'badminton'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000002'::uuid, v.id, s.id,
  'Court 2', 4, 1500, 60, true
from venues v, sports s
where v.id = '11111111-1111-1111-1111-111111111111'::uuid and s.slug = 'badminton'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000003'::uuid, v.id, s.id,
  'Table 1', 4, 800, 60, true
from venues v, sports s
where v.id = '11111111-1111-1111-1111-111111111111'::uuid and s.slug = 'table-tennis'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000004'::uuid, v.id, s.id,
  'Turf A (5-a-side)', 10, 4500, 60, false
from venues v, sports s
where v.id = '22222222-2222-2222-2222-222222222222'::uuid and s.slug = 'football'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000005'::uuid, v.id, s.id,
  'Turf B (full)', 22, 9000, 60, false
from venues v, sports s
where v.id = '22222222-2222-2222-2222-222222222222'::uuid and s.slug = 'football'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000006'::uuid, v.id, s.id,
  'Net 1', 6, 2000, 60, true
from venues v, sports s
where v.id = '33333333-3333-3333-3333-333333333333'::uuid and s.slug = 'cricket'
on conflict do nothing;

insert into courts (id, venue_id, sport_id, name, capacity, price_per_slot, slot_duration_min, is_indoor)
select
  'aaaaaaaa-0000-0000-0000-000000000007'::uuid, v.id, s.id,
  'Net 2', 6, 2000, 60, true
from venues v, sports s
where v.id = '33333333-3333-3333-3333-333333333333'::uuid and s.slug = 'cricket'
on conflict do nothing;

insert into events (id, organizer_id, venue_id, sport_id, name, description, start_at, end_at, city, capacity, price)
select
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  u.id, v.id, s.id,
  'Friday Night Badminton Social',
  'Open social games for all levels. Shuttles provided.',
  now() + interval '7 days', now() + interval '7 days 3 hours',
  'Colombo', 16, 1000
from users u, venues v, sports s
where u.firebase_uid = 'demo-owner-uid'
  and v.id = '11111111-1111-1111-1111-111111111111'::uuid
  and s.slug = 'badminton'
on conflict (id) do nothing;

insert into events (id, organizer_id, venue_id, sport_id, name, description, start_at, end_at, city, capacity, price)
select
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  u.id, v.id, s.id,
  'Five-a-side Football Tournament Night',
  'Round-robin five-a-side night under lights.',
  now() + interval '14 days', now() + interval '14 days 4 hours',
  'Colombo', 60, 2500
from users u, venues v, sports s
where u.firebase_uid = 'demo-owner-uid'
  and v.id = '22222222-2222-2222-2222-222222222222'::uuid
  and s.slug = 'football'
on conflict (id) do nothing;

-- 0015_brand_myslot_lk.sql
-- Rebrand: default brand becomes MySlot.LK and demo seed users move to the
-- myslot.lk domain. Idempotent — safe to re-run.
insert into platform_config (key, value, updated_at) values
  ('brand_name', '"MySlot.LK"'::jsonb, now())
on conflict (key) do update set value = excluded.value, updated_at = now();

update users
set email = regexp_replace(email, '@spots\.lk$', '@myslot.lk')
where role in ('admin', 'venue_owner', 'player')
  and email like '%@spots.lk';
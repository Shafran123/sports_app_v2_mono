-- 0020_widget_key_backfill.sql
-- ADR-0028: venues created before the off-platform feature have a NULL
-- widget_key and slug. Backfill every missing key, and generate unique slugs
-- for every missing slug (same rules as venue creation).

-- Widget key: random 32-hex, unique index is partial-where-not-null, so only
-- rows missing one are filled; collisions are astronomically unlikely.
update venues
   set widget_key = encode(gen_random_bytes(16), 'hex')
 where widget_key is null;

-- Slug backfill with uniqueness probing, oldest venues first so earlier ones
-- keep the clean slug (later ones pick up -2, -3...).
do $$
declare
  v record;
  base text;
  candidate text;
  n int;
begin
  for v in select id, name from venues where slug is null order by created_at loop
    base := left(btrim(lower(regexp_replace(coalesce(v.name, ''), '[^a-z0-9]+', '-', 'g')), '-'), 60);
    if base = '' then
      base := 'venue-' || encode(gen_random_bytes(3), 'hex');
    end if;
    candidate := base;
    n := 1;
    while exists (select 1 from venues where slug = candidate and id <> v.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update venues set slug = candidate where id = v.id;
  end loop;
end $$;
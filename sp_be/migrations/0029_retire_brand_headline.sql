-- Retire the `headline` brand token (brand-consolidation ticket 01).
--
-- The owner editor previously split the business description across `headline`
-- (Site brand card) and `about` (Business brand card); the site rendered
-- `about` first and fell back to `headline` + `tagline`. The consolidation
-- keeps `tagline` (short) and `about` (long) and drops `headline` entirely.
--
-- Migration semantics: copy `headline` into `about` when `about` is unset
-- (and the headline is non-empty), then delete the `headline` key everywhere.

update businesses
set brand = jsonb_set(brand, '{about}', brand->'headline')
where brand ? 'headline'
  and not (brand ? 'about')
  and (brand->>'headline') <> '';

update businesses
set brand = brand - 'headline'
where brand ? 'headline';

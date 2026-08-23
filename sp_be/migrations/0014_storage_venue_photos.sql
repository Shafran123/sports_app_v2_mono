-- 0014_storage_venue_photos.sql
-- Venue photos moved to Supabase Storage (ADR-0010). The legacy /uploads/*
-- URLs point at files that no longer exist (Railway volume wipe — unrecoverable).
-- Clear them so the storefront stops rendering broken images; owners re-upload
-- through the admin form, and new uploads land in the venue_images bucket.

update venues
set photos = '[]'::jsonb, updated_at = now()
where photos <> '[]'::jsonb;
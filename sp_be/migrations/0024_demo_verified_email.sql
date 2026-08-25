-- 0024_demo_verified_email.sql
-- Demo users stay bookable in pre-prod after the Verified Email gate landed:
-- mark their emails verified (they are platform-controlled demo accounts).

update users set email_verified_at = now()
where firebase_uid in ('demo-admin-uid', 'demo-owner-uid', 'demo-player-uid')
  and email_verified_at is null;
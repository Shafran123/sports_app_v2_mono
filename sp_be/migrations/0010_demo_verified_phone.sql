-- Demo users stay bookable in pre-prod: mark their phones verified.
update users set phone_verified_at = now()
where firebase_uid in ('demo-admin-uid', 'demo-owner-uid', 'demo-player-uid')
  and phone_verified_at is null;
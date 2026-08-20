# 04 — Auth & profiles

**What to build:** a user can sign up / log in (email+password, Google, phone OTP via Firebase Auth) and the platform creates a Postgres `users` row on first login. The API verifies the Firebase JWT on every request and resolves the user's role. The frontend's login/register/profile pages work against this.

**Blocked by:** 02 — Supabase schema + seed.

**Status:** ready-for-agent

- [ ] Sign-up/login with email+password, Google, and phone OTP all reach the logged-in state
- [ ] First authenticated request upserts the user row; role (player/venue_owner/admin) is readable by the API
- [ ] Every protected route rejects missing/invalid JWTs; role checks reject cross-role access (e.g. player hitting admin routes)
- [ ] Frontend login, register, and profile pages (name, phone, city edit) work on the new API; sessions persist across reloads
- [ ] Admin seed account can log into the admin area

## Comments
Completed: 2026-08-19

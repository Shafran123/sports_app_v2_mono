# 04 — Player auth and app shell

**What to build:** a Player can log in or register (email, phone OTP, Google) and lands inside the new player shell — sticky top nav, mobile bottom tabs, desktop footer — with protected routes enforced.

**Blocked by:** 02 — Shared UI kit and utils; 03 — Typed API layer and domain types.

**Status:** ready-for-agent

- [ ] Login (email+password, phone OTP with resend/countdown and change-number, Google), register — all in the new identity, no splash screen, no onboarding
- [ ] Session restore via Firebase ID token → auth/me; the role is available to guards
- [ ] Protected routes: bookings, booking detail, profile, notifications redirect unauthenticated Players to login
- [ ] Player shell: sticky top nav (wordmark, search, links, notification bell, avatar), bottom tabs on mobile, footer on desktop — light identity
- [ ] Build + tests green
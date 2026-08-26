# 01 — Site Customer auth: own identity backend (ADR 0030)

**What to build:** Site Customers are per-Business identities served by our own auth, not Firebase. A `site_customers` table keyed by `(business_id, email)` holding credentials (password hash), contact data, and per-Business verification state (phone/email verified). Email+password sign-up/sign-in with our own session token; phone and email OTP verification reuses the existing OTP infrastructure but scopes challenges to the Business's tenant (ADR-0030: same person re-verifies at each Business). Sessions survive across site hostname and widget surfaces. Google sign-in maps the Google identity to a per-Business Site Customer profile. Firebase remains only for platform accounts.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migration: `site_customers` (business_id, email unique per business, password_hash, name, phone, email_verified, phone_verified, google_sub, created_at, updated_at) + indexes on (business_id, email)
- [ ] Password hashing (bcrypt/argon2) + session token issue/verify middleware (`requireSiteCustomer`)
- [ ] Sign-up validates uniqueness per Business only — same email at two Businesses is two independent accounts (ADR-0030 Q7)
- [ ] OTP challenge scoped to a Business tenant; verification flags live on the Site Customer
- [ ] Google sign-in endpoint maps `google_sub` to a Site Customer, creating one per Business if absent
- [ ] Auth-required booking gate uses Site Customer verification (Verified Phone + Verified Email per Business)
- [ ] Tests: cross-Business independence, per-Business re-verification, session expiry/renewal, Google mapping
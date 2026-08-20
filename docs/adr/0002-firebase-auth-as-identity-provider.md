# Firebase Auth as the identity provider

The MVP keeps Firebase Auth (email/password, Google, phone OTP) as the identity provider while all domain data lives in Supabase Postgres keyed by the Firebase UID. The frontend already integrates Firebase, and Firebase phone OTP works in Sri Lanka, which is where the MVP launches.

**Considered options**: unifying on Supabase Auth (single identity, RLS usable) — rejected because phone OTP needs Twilio credits and the existing frontend integration would be reworked anyway.

**Consequences**: split identity means Supabase RLS cannot authorize against user rows; the Express API verifies Firebase JWTs and enforces RBAC (Player / Venue Owner / Admin). Reconsider only if the API layer is ever dropped.

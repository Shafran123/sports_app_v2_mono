# Supabase (Postgres) for persistence

The prototype stored everything in Firebase Firestore. The MVP moves persistence to Supabase (managed Postgres) while keeping the Express API. Firestore's schemaless model cannot express the integrity constraints the marketplace needs (exclusion constraints against double-booking, transactional holds, relational reporting); the product spec always required PostgreSQL with transactional locking.

**Considered options**: staying on Firestore (constraint workarounds that invite double-booking bugs); self-hosted Postgres (more ops for a solo dev); NestJS rewrite (larger than the MVP). Supabase adds managed Postgres plus Storage and Realtime for what Firestore used to provide.

**Consequences**: Supabase RLS is unusable for domain authorization because identity lives in Firebase (see ADR-0002) — authorization is enforced in the Express API.

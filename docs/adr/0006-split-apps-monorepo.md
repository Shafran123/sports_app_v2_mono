# One monorepo, two frontend apps, shared typed packages

The rebuild splits the frontend into two separate Next.js applications — a player marketplace app (`apps/user`) and an operator/admin console (`apps/admin`) — while keeping one repository and shared packages. The existing backend (`sp_be`) remains the single source of truth; there is no mock layer in a production build.

**Why**: the two surfaces have fundamentally different information architectures (marketing-grade marketplace vs role-based SaaS console); separate apps deploy and scale independently; but the domain vocabulary, types, API contract, token system, and design language are one product, so they share packages rather than duplicate code.

**Decisions**:

- pnpm + Turborepo monorepo at the repo root; `apps/user`, `apps/admin`.
- Shared packages: `@spots/ui` (design tokens + primitive + domain components, shadcn-conventional layout), `@spots/types` (domain models + Zod schemas matching sp_be responses), `@spots/api` (typed axios service layer over sp_be, Zod-validated, callback-friendly for tests), `@spots/utils` (currency/date/imagery/classname helpers), `@spots/config` (ESLint/TS config bases).
- Auth: both apps use the same Firebase identity + sp_be `/auth/me` role model; guards are per-app: player app protects bookings/profile/notifications; console requires admin or venue_owner role and forks its sidebar by role. admin-only routes bounce non-admins.
- Strict visual-only boundary vs. the backend: routes, flows, and booking logic are the backend's; the frontend only adds typed contracts and UI.

**Consequences**: any new endpoint in sp_be gets a typed service method before screens consume it; the two apps may be deployed separately (each Next.js build is standalone); console mobile is a simplified responsive layout (drawer sidebar, sticky headers), not a "shrunken desktop".
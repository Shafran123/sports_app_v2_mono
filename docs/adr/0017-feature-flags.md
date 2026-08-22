# 0017 — Feature flags: `platform_config` + registry + per-request DB reads + audit trail

- **Status:** accepted
- **Date:** 2026-08-22

## Context

SMSGo cannot send SMS until business registration clears, PayHere is dormant, and Events need an admin-controlled surface state. The platform earlier sized `platform_config` (key/value jsonb) for admin configuration.

## Decision

Feature flags are `platform_config` rows governed by a **canonical registry** (`utils/featureFlags.js` — name, type, default, description). All reads are **direct DB reads on every gated request** — no caching, no TTL. Admin changes mutate via `PUT /admin/config/flags/:name` and append to a `flag_audits` table (admin, old, new, at). The player app reads current values from a minimal public endpoint.

## Trade-offs

- **DB-read vs cached TTL:** instant propagation, one code path, no invalidation bugs; cost is a single-row lookup per gated request — negligible at this scale.
- **Registry vs ad-hoc keys:** a registry keeps frontend and admin console honest about what flags exist, and validates writes.
- Audit trail chosen deliberately: "who disabled phone verification?" must be answerable.

## Consequences

- First flags: `phone_verification_required` (default **OFF**), `sms_enabled` (OFF), `payhere_enabled` (OFF), `events_discovery_state` (enabled).
- All gates read through the registry; nothing client-trusted.
- Revisit TTL caching only under measured profile.
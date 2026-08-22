# 01 — Feature-flag registry + admin mutation endpoint + audit trail

Type: task
Status: ready-for-agent

## Context

Flags live in `platform_config` (key/value jsonb). The admin console (apps/admin) and player app (apps/user) both need consistent definitions and a safe write path.

## Deliverables

- `sp_be/utils/featureFlags.js` — canonical registry: each flag = { name, type: 'boolean'|'enum', default, description }. Seed defaults into `platform_config` (migration `0013`).
- Admin read endpoint `GET /admin/config` + write `PUT /admin/config/flags/:name` (admin-only middleware). Validate type + allowed enum values.
- `flag_audits` table (migration): admin id, flag name, old value, new value, changed_at. Append row on every change.
- Public read endpoint `GET /public/feature-flags` (no auth) returning current flag values for the player app.

## Done

- [ ] Registry exported; migration seeds all five flags with correct defaults.
- [ ] PUT validates + persists + audits; GET returns current values.
- [ ] Public endpoint reachable unauthenticated.
- [ ] Tests: flag mutation, audit row written, invalid enum rejected.

Blocked by: none
## Completed

Implemented. Evidence: sp_be commit `b50c281` (backend) + root commit `2a1b4ed` (frontend/types/spec). Backend suite 214/214, user 39/39, admin 11/11, api 22/22 green; all packages typecheck.

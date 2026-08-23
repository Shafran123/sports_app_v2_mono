# 02 — Internal package rename: @spots/* → @myslot/*

**What to build:** rename the internal package namespace so no code identifier says "spots".

- Root `package.json`: `name` → `myslot`; `dev:user` / `dev:admin` filters → `@myslot/user` / `@myslot/admin`.
- `packages/api`, `packages/auth`, `packages/config`, `packages/types`, `packages/ui`, `packages/utils`: package.json `name` → `@myslot/*`; `packages/config/tsconfig.*.json` `display` strings.
- All `@spots/*` import specifiers in `apps/*` and `packages/*` → `@myslot/*`.
- Regenerate `pnpm-lock.yaml` (re-run `pnpm install` / `pnpm-workspace.yaml` sync).
- Sweep `dev.sh`, `turbo.json`, and any script/README references to `@spots/*`.
- Optional (not required): rename the gitignored Firebase service-key JSON (`sports-app-20029-…`) — no code references it.

**Blocked by:** —

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] No `@spots/` import specifier or package name remains in `apps/*` or `packages/*`
- [ ] `pnpm install` succeeds and `pnpm-lock.yaml` is consistent
- [ ] `pnpm --filter @myslot/user dev` and `@myslot/admin` still work
- [ ] `turbo run lint`, `turbo run typecheck`, `turbo run test` pass

## Comments
The `brand_name` config key is NOT part of this ticket — it stays named `brand_name` (generic data key, renaming it is a pointless data migration).
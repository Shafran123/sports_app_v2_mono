# 01 — Scaffold `apps/landing` Next.js app in the workspace

**What to build:** a new Next.js 15 marketing app at `apps/landing/`, package `@myslot/landing`, wired into the turbo workspace exactly like `apps/user` so it reuses the shared packages and the backend proxy.

- **App files**: `apps/landing/package.json` (name `@myslot/landing`, dependencies on `@myslot/ui`, `@myslot/api`, `@myslot/types`, `@myslot/utils`, `next`, `react`, `react-dom`, `tailwindcss`, `lucide-react`, `vitest`); `next.config.mjs` with `transpilePackages: ["@myslot/ui", "@myslot/utils", "@myslot/types", "@myslot/api"]` and the same rewrite as `apps/user/next.config.mjs` (`/api/:path*` → `${NEXT_PUBLIC_API_URL}/api/v1/:path*`, default `http://localhost:2400`); `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts` copied from `apps/user` and pointed at the new app.
- **Register in the workspace**: add `@myslot/landing` to the root `package.json` filter scripts (`dev:landing`, or extend `dev:user`/`dev:admin`), and confirm `pnpm-workspace.yaml` / `pnpm-lock.yaml` pick it up on next install.
- **Design system**: `apps/landing/src/app/globals.css` importing `@myslot/ui/globals.css` (tokens come with it — the current light-premium ADR-0005 identity, not the dark ADR-0004).
- **Layout + metadata**: `src/app/layout.tsx` importing Plus Jakarta Sans + Sora via `next/font/google`, `dynamic = "force-dynamic"`, and `generateMetadata` reading `brand_name` from the public config server-side with fallback `MySlot.LK — Find Your Game` (same `getBrandName()` pattern as `apps/user/src/app/layout.tsx`).
- **Root route**: `src/app/page.tsx` rendering a minimal placeholder page so the app boots and builds before sections land.

**Blocked by:** —

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [x] `turbo run build` and `turbo run typecheck` green for `@myslot/landing`
- [ ] `pnpm --filter @myslot/landing dev` serves `/` and the `/api/:path*` proxy forwards to the backend (smoke: page served at :3002; proxy needs a live backend)
- [x] Browser tab reads `MySlot.LK — Find Your Game` with the backend running (config-driven) and without it (fallback)
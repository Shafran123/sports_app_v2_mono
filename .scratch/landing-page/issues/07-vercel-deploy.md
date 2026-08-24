# 07 — Vercel deploy for `apps/landing` (Next.js detection fix)

**What to build:** make the landing site deployable on Vercel with the same per-app configuration as `apps/user` and `apps/admin` — Root Directory `apps/landing`, a per-app `vercel.json`, and no root-level monorepo `vercel.json`.

## Root cause

Vercel's Next.js preset detects the framework by reading the `package.json` at the project's **Root Directory** and checking for `next` in `dependencies` / `devDependencies`. The landing Vercel project (`myslot-landing-v2`) was set up as a monorepo project rooted at the **repo root** (via a root `vercel.json` with `installCommand`/`buildCommand`/`framework`). At the repo root, `package.json` is the pnpm workspace root (`myslot`) — it declares no `next`, so Vercel fails with:

> No Next.js version detected. Make sure your package.json has "next" in either "dependencies" or "devDependencies". Also check your Root Directory setting matches the directory of your package.json file.

`apps/user` and `apps/admin` don't hit this because each Vercel project has Root Directory set to its app dir, where `package.json` declares `next`. Detection check (mirrors Vercel's read):

```
$ for d in . apps/user apps/admin apps/landing; do python3 /tmp/opencode/vercel-next-check.py "$d"; done
FAIL: package.json has no 'next' in dependencies or devDependencies   <- repo root (current landing Root Directory)
PASS: apps/user/package.json declares next in dependencies (15.5.23)
PASS: apps/admin/package.json declares next in dependencies (15.5.23)
PASS: apps/landing/package.json declares next in dependencies (15.5.23)   <- fix
```

## Fix (repo — done)

- Add `apps/landing/vercel.json` mirroring `apps/user/vercel.json` (`ignoreCommand` → deploy `main` only).
- Remove the root `vercel.json` (repo-root monorepo build config). It only applies when the Root Directory is the repo root — the exact misconfiguration that fails detection — and is ignored once Root Directory is `apps/landing`.
- `.gitignore`: drop the `!/vercel.json` exception, add `!/apps/landing/vercel.json`.

## Fix (dashboard — human step, cannot be done from the repo)

1. Vercel → project `myslot-landing-v2` → Settings → General → **Root Directory** set to `apps/landing` (framework preset stays Next.js).
2. Env (Production):
   - `NEXT_PUBLIC_API_URL` → Railway URL (landing's `/api/:path*` rewrite needs it)
   - `NEXT_PUBLIC_PLAYER_APP_URL` → deployed user-app URL
   - `NEXT_PUBLIC_FIREBASE_API_KEY` / `AUTH_DOMAIN` / `PROJECT_ID` / `APP_ID` (+ `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` for GA4) — same Firebase project as the other apps
3. Deploy `main`; confirm the site loads and the inquiry form posts through `/api/...` to Railway.

**Blocked by:** —

**Status:** ready-for-human (repo fix applied; Root Directory confirmed set; env vars pending)

- [x] Repo: `apps/landing/vercel.json` present (deploy main only)
- [x] Repo: root `vercel.json` deleted; `apps/landing/package.json` declares `next` 15.5.23 (detection PASS)
- [x] Dashboard: Root Directory `apps/landing` set on `myslot-landing-v2`
- [ ] Dashboard: env vars above set
- [ ] Deploy succeeds (no "No Next.js version detected"); `/` 200 and lead form posts to Railway
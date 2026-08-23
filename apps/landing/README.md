# @myslot/landing

Public marketing page for MySlot.LK — "List your venue free for 3 months".

## Run it

```sh
# From the workspace root — requires sp_be running on :2400
pnpm --filter @myslot/landing dev
```

The app proxies `/api/:path*` to the backend (same pattern as `apps/user`), so the
inquiry form posts to the existing `/public/leads` endpoint without any CORS work.

## Env vars

| Variable | Purpose | Fallback |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL for the `/api` rewrite and page metadata brand fetch | `http://localhost:2400` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Enables Firebase Analytics (GA4). Unset → no-op, no scripts | unset |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_APP_ID` / `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase init (same convention as `packages/auth`) | — |
| `NEXT_PUBLIC_PLAYER_APP_URL` | "Try the player app" / "Explore venues" outbound links | `http://localhost:3000` |

## Deploy assumption

The marketing page owns the root domain; the product apps live on subdomains
(e.g. `app.myslot.lk`). Set `NEXT_PUBLIC_PLAYER_APP_URL` accordingly. Deploy via
Vercel as a separate project.

## Verifying

- `pnpm --filter @myslot/landing test` — vitest (seams: analytics gating, screenshot resolution, inquiry form)
- `pnpm --filter @myslot/landing typecheck`
- `pnpm --filter @myslot/landing build`
- Manual walkthrough: form submit against the dev backend, then confirm the lead in the admin console.
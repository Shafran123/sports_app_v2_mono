# 03 — Vercel apps: /uploads rewrite (mirror of the /api rewrite)

Type: task
Status: ready-for-agent

## Context

Venue photos are stored on the Railway volume and served at `/uploads/<uuid>.<ext>` on the backend. Browsers hit `img src="/uploads/..."` on each app's own origin, so both Next.js apps need a rewrite mirroring the existing `/api` one. Photos render via plain `<img>` — no `next/image`, so no remotePatterns config needed.

## Deliverables

- `apps/user/next.config.mjs` and `apps/admin/next.config.mjs`:

```js
rewrites: async () => [
  { source: "/api/:path*", destination: `${NEXT_PUBLIC_API_URL}/api/v1/:path*` },
  { source: "/uploads/:path*", destination: `${NEXT_PUBLIC_API_URL}/uploads/:path*` },
]
```

## Done

- [ ] Both apps' `npm run lint`, `npm run typecheck`, `npm run build` pass.
- [ ] Local smoke: backend running with `NEXT_PUBLIC_API_URL` set → `GET /uploads/<existing file>` returns the image through the rewrite.

Blocked by: 01
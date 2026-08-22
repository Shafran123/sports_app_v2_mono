# 02 — Backend origin split: SOCKET_ALLOWED_ORIGINS (socket CORS ≠ FRONTEND_URL)

Type: task
Status: ready-for-agent

## Context

`FRONTEND_URL` is overloaded: it is the base for PayHere `return_url`, booking-QR links and email bases (all player-facing) **and** the CORS origin for REST + socket.io. REST is same-origin through the Vercel rewrites, but admin's socket.io connects browser → Railway directly, so socket CORS must admit the admin app's origin while `FRONTEND_URL` stays the user app's.

## Deliverables

- `sp_be/utils/origins.js` (new):

```js
function getAllowedOrigins(env) {
  const list = (env.SOCKET_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : [env.FRONTEND_URL].filter(Boolean);
}
module.exports = { getAllowedOrigins };
```

- `sp_be/realtime.js`: `cors: { origin: getAllowedOrigins(process.env), credentials: true }` (replaces single `FRONTEND_URL`).
- `sp_be/config/env.js`: add `SOCKET_ALLOWED_ORIGINS` to the optional vars (when set, must survive split/trim non-empty).
- `sp_be/.env.example`: document the new var.
- `sp_be/test/origins.test.js`: split/trim behavior; empty env falls back to `[FRONTEND_URL]`; missing both → `[]`.
- `app.js`, `utils/payhere.js`, `utils/tokens.js` unchanged.

## Done

- [ ] `npm test` in `sp_be` green (baseline 214 + new suite).
- [ ] `realtime.js` uses the allow-list; no other `FRONTEND_URL` consumer changed.

Blocked by: 01
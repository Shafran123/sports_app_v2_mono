# 09 — Security headers, CORS lockdown, host-header trust

**What to build:** defense-in-depth for transport: helmet headers, no wildcard CORS fallback, and payhere return/notify URLs built from config, not the Host header.

**Blocked by:** 01 (env fail-closed makes `FRONTEND_URL` guaranteed present)

**Status:** ready-for-agent

## Scope

- Add `helmet` (includes `X-Content-Type-Options: nosniff`, HSTS, frame options, etc.): `app.use(helmet())`.
- CORS (`app.js:30-36`): `origin` must be exactly `FRONTEND_URL` (single origin) or an explicit allow-list env var — **no `|| '*'` fallback**. With #01 shipped, missing `FRONTEND_URL` means the app doesn't boot. Same for Socket.io `realtime.js:14` — origin locked, `credentials: true` kept.
- Host-header trust: `utils/tokens.js:11-13` `requestBaseUrl` uses `req.headers.host` to build the PayHere return/notify URL → an attacker-controllable `Host` redirects customer return flows to their host. Build the base from config: `FRONTEND_URL` (or a new `APP_BASE_URL` = the API's own public origin). Verify every call site (checkout, event checkout, payment notify) uses the new base.
- Static `/uploads` reads with `helmet`'s `nosniff` (already covered) — confirm header present on that route.

## Verification

- Supertest: response headers include `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (when served over TLS), frame default.
- Origin test: request with `Origin: https://evil.example` + our credentials → no `Access-Control-Allow-Origin: *`.
- Unit: `requestBaseUrl` with a hostile `Host` header returns the configured base.
- Grep: no `origin: '*'` fallback remains.

## Done criteria

- [ ] `helmet()` mounted; nosniff present.
- [ ] CORS/Socket locked to configured origin; wildcard fallback gone.
- [ ] PayHere return/notify built from config, not Host.
- [ ] Suite green.
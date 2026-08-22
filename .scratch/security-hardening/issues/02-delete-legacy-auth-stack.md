# 02 — Delete the legacy self-minted JWT auth stack

**What to build:** remove the dead-but-dangerous legacy auth stack that mints JWTs with `role` in the payload signed by a known public fallback secret.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

Verified findings (audit 2026-08-22):
- `middleware/authMiddleware.js` + `middleware/userMiddleware.js` — `jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')` and trust `decoded.role === 'admin'`.
- `controller/adminController.js:134-142` + `controller/userController.js:138-146` — `jwt.sign({uid, email, role}, ...)`, `expiresIn: '24h'`.
- `routes/admin.js`, `routes/user.js` — never mounted in `app.js`; only wire these controllers up.

Actions:
- Confirm each target is genuinely unreferenced (grep across `app.js`, tests, realtime, scripts) before deletion.
- Delete the dead routers, middlewares, and controllers (incl. `yardController.js` if unmounted).
- Delete tests that only exercised the legacy stack.
- Grep the repo to confirm no remnant mints or verifies a bespoke JWT; the only tokens the backend accepts are Firebase ID tokens (`verifyIdToken`) and the one-time `qr_token`.

## Verification

- `npm test` green after deletion.
- Grep proves zero `jwt.sign` / `jwt.verify` / `jsonwebtoken` imports left in `sp_be` (or only the documented test path).
- No route regressions: mounted routers in `app.js` are untouched.

## Done criteria

- [ ] All five legacy files deleted (or rewritten where a function is genuinely shared — flag it if so).
- [ ] `------- ` grep for `jsonwebtoken`/`jwt.sign`/`jwt.verify` comes up empty outside test mode.
- [ ] Test suite green; server boots and existing API smoke checks pass.
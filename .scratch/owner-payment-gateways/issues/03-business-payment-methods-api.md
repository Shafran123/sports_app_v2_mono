# 03 — Business payment-methods API

**What to build:** owner-facing backend endpoints to read/update the Business's payment methods, save/remove PayHere credentials, and validate them. Mirrors the existing `business.js` route pattern.

- `GET /business/payment-methods` — methods + enabled state + `configured` flags + masked hints (never plaintext secrets).
- `PUT /business/payment-methods` — toggle `cash` and/or `payhere` on/off. Server guard: **at least one method must remain enabled** (`400 AT_LEAST_ONE_METHOD_REQUIRED`). Turning `payhere` on requires valid stored credentials (else `400 PAYHERE_NOT_CONFIGURED`).
- `PUT /business/payment-methods/payhere/credentials` — accepts merchant ID, merchant secret, app ID, app secret; validates the **app pair** via PayHere OAuth token call (`POST sandbox.payhere.lk/merchant/v1/oauth/token`, Basic auth of base64(app_id:app_secret)) — invalid pair → 400, no save. Merchant secret cannot be validated at this point ("Awaiting first transaction" state). Encrypt secrets via 02's service; store; invalidate cache.
- `DELETE /business/payment-methods/payhere/credentials` — "remove keys" action: clears stored credentials; if `payhere` is enabled, flips it off (guard from above still applies — if cash is off too, reject: owner must enable cash first or keep payhere).
- Owner authorization: only the Business's owner may mutate; admins read-only (07).
- Response shape: `{ cash: {enabled}, payhere: {enabled, configured, app_last4, state: 'configured'|'invalid_app_credentials'|'awaiting_first_transaction'|'not_configured'} }`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Endpoints with the guard, validation, and encryption semantics above
- [ ] Auth: owner-only mutations; 403 otherwise
- [ ] Tests: toggle guard, invalid app creds rejected, remove-keys semantics, no plaintext in responses
## Status (2026-08-30, amended by ADR-0047)

"Encryption semantics" no longer apply — save/remove now round-trip Google Secret Manager (per-Business secret) and the row stores only the non-secret IDs; without SECRET_MANAGER_CREDENTIALS the save/remove endpoints fail with PAYHERE_SECRET_MANAGER_REQUIRED.

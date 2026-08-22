# ADR-0014 — Firebase ID tokens only; no server-issued sessions or self-minted JWTs

- **Status:** accepted
- **Date:** 2026-08-22
- **Supersedes:** the legacy self-minted JWT stack (now deleted)

## Context

The live API authenticates every mounted route with Firebase ID tokens (`verifyIdToken`). A dead legacy stack (`routes/admin.js`, `routes/user.js`, `middleware/authMiddleware.js`, `userMiddleware.js`) minted bespoke JWTs with `role` in the payload, signed with a fallback secret (`'your-secret-key'`) — a total-takeover landmine if ever mounted.

## Decision

Firebase ID tokens are the **only** credential the backend accepts. No server-issued session tokens, no refresh tokens, no bespoke signed JWTs — the legacy stack is deleted, not parked. Consequences accepted deliberately: leaked ID tokens stay valid until Google's natural expiry (~1h), there is no server-side logout/revocation, and reconnection after expiry requires a fresh token (Socket.io).

## Trade-offs

- Server sessions would add revocation/logout but reintroduce exactly the self-minted-token surface this hardens; Firebase's token lifecycle already expires credentials server-side without our state.
- Deleting (vs. flag-guarding) the legacy stack means restoring it requires git history — that friction is the point: it must never silently remount.

## Consequences

- Roles always resolved from the DB (`users.role`) after `verifyIdToken` — never trusted from a token claim.
- Secrets for any future signed thing fail closed at boot (missing env = no boot), see ADR-0015.
- Socket.io and any future realtime path must reuse the same Firebase verification.
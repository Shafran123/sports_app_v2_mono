# 04 — reCAPTCHA backend verification

**What to build:** A backend verification service + reusable middleware that validates a Google reCAPTCHA v3 token via siteverify, checks the expected action name, and validates the hostname reported by the token against the request's own origin. One shared site key configured via environment. Exposes the verified score so routes can decide escalate-vs-reject. Fails closed on missing/invalid/expired tokens.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Shared site key via env, no per-domain allowlisting
- [ ] siteverify called server-side; token single-use/expiry respected
- [ ] Action name validated against what each route expects
- [ ] Hostname in the token must match the request origin
- [ ] Fails closed; returns score for escalate-vs-reject decisions
- [ ] Backend tests cover valid, missing, invalid, expired, wrong-action, wrong-hostname

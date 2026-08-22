# 02 — Firebase console config for phone sign-in

**What to build:** complete the human-only Firebase console steps that gate phone sign-in end to end: SMS region policy, authorized domains, and fictional test numbers. Steps only a console user can perform; no code changes.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] **Enable Phone provider** — Firebase console → Security → Authentication → Sign-in method → enable **Phone**
- [ ] **SMS region policy** — Security → Authentication → Settings → SMS region policy: allow `LK` (Sri Lanka), plus any testing regions (e.g. `US`) where users will verify. Default is **no regions — SMS silently fails until this is set**.
- [ ] **Authorized domains** — Security → Authentication → Settings → Authorized domains: add the deployed user-app domain (e.g. the Vercel app URL). `localhost` is not allowed for phone auth.
- [ ] **Fictional test numbers** — Sign-in method → "Phone numbers for testing": add 2–3 numbers that are fictional and correctly formatted (e.g. `+1 650 555 3434` with a 6-digit code like `654321`); up to 10 allowed; keep codes hard to guess and rotate them.
- [ ] **Security hygiene** — store test numbers/codes outside the repo (never hardcode in the app), and note they mint ID tokens with the same signature as real users; rotate them periodically.
- [ ] End-to-end confirm with a real device + real number (a real SMS is sent): OTP arrives, code logs in, `users.phone` populated.

## Comments

Done criteria depends on 01 (code hardening) being in place to observe the full flow. Requires console access to the Firebase project (`sports-app-20029`).
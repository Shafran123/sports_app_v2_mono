# 08 — PayHere: live merchant cutover (post-launch follow-up)

Type: task
Status: ready-for-human

## Context

Pre-prod ships on sandbox credentials (decision Q6). Moving to live payments touches money paths and must be deliberate.

## Deliverables

- Complete one full sandbox E2E: checkout → PayHere sandbox → notify → booking marked paid → refund via `PAYHERE_AUTHORIZATION`.
- Update Railway envs: `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_CHECKOUT_URL` (live), refund creds.
- Flip `payhere_enabled` flag to ON only after the sandbox E2E passes.
- Keep `@spots/api`'s hardcoded sandbox submit URL in sync — point it at the env-provided `checkout_url` (client uses the server's `payment_params.checkout_url`; verify admin side too).
- Add a paid-booking regression row to the verification checklist.

## Done

- [ ] Sandbox E2E green; live creds set; a real paid booking flows end-to-end; refund works.

Blocked by: 07
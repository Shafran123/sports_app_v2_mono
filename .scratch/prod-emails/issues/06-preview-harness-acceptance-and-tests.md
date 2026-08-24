# 06 — Preview harness acceptance + template tests

**What to build:** the approval seam — render all emails locally and eyeball them in a real mail client; lock the new markup with pure-function tests.

**Depends on:** 01–05

**Status:** ready-for-agent

**Seam:** `sp_be/scripts/render-emails.js` + `test/emailTemplates.test.js` (no DB).

- [ ] `render-emails.js` finalised: one fixture set (booking: confirmed/cash/online, reminder, bill, player-cancel, owner-new-booking, owner-cancelled, venue-approve/reject, owner-welcome/renew/nudge, lead, digest, welcome, event-reg/cancel) → `.scratch/emails-preview/*.html` + `index.html` grid.
- [ ] Manually open in Apple Mail + Gmail (web): confirm the paper/ink/green identity reads premium, wordmark renders, CTA button is not textlink, no overflow on mobile.
- [ ] `.gitignore`: `.scratch/emails-preview/`.
- [ ] `test/emailTemplates.test.js` (pure, no DB): every player booking email has (a) brand wordmark, (b) preheader, (c) CTA → `FRONTEND_URL/bookings`, (d) venue address/phone (when present), (e) inline QR + warning (confirm/reminder/bill), (f) plain-text block; owner emails: wordmark + CTA → console, **no`qr_token`**, no player email; event emails: shell, event block, CTA, no QR.
- [ ] `npm test` green.

## Comments

Human acceptance happens through the harness (open the HTML files) — that's the "prod-grade" gate; the pure tests gate regressions mechanically.
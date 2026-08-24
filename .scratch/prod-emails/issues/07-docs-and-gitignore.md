# 07 — Docs + ADR + glossary + gitignore

**What to build:** the paper trail: ADR-0024 (QR in player's own transactional inbox), `CONTEXT.md` QR Token wording already amended, Booking Alert term (recorded in an earlier round), `.gitignore` entries for the preview harness.

**Depends on:** 01–06

**Status:** ready-for-agent

- [ ] `docs/adr/0024-qr-disclosed-to-booking-player-inbox.md` — context, decision (QR by inline-CID in confirm/reminder/bill emails; never to owners; shared loader stays secret), why, consequences.
- [ ] `CONTEXT.md` **QR Token** disclosure line updated to "…and in transactional emails sent to that player's own inbox (confirmation, reminder, bill)" — already applied earlier this session; verify the wording reads clean.
- [ ] `CONTEXT.md` **Booking Alert** already exists (owner-side booking notice) — verify.
- [ ] `.gitignore` gains `.scratch/emails-preview/`.
- [ ] `.env.example`: confirm `MAILGUN_*`, `FROM_EMAIL`, `FRONTEND_URL`, `SMSGO_*` groups are documented with the new domain comment.

## Comments

- No schema migration: the QR lives in the existing `outbound_messages` audit row, no new table.
- The event emails have **no** QR — decisions Q16/Q18 (event registrations have no venue check-in token; once events grow QR later, the plumbing already exists).
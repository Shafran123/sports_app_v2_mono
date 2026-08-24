# Production-grade transactional emails + QR in booking emails

Status: ready-for-agent

## Problem

All 17 transactional emails share one `shell()` (sp_be/utils/emailService.js:80) — no brand, no logo, no CTA, no venue contact info, no preheader, no plaintext, and no QR (QR only lives in the bill PDF). The marketplace's identity is ADR-0005 light-premium: paper base `#fafaf7`, ink `#0e1512`, court-green primary `#16a34a`, blue accent `#2563eb`, `rounded-3xl` cards, Sora/Plus Jakarta display. The task: put the QR into the booking emails and make emails "prod-grade".

## Contract

- **Shell** (`sp_be/utils/emailTemplates.js` — new) —shared Outlook-safe **table** email layout: header wordmark "MySlot" (green) + ".LK" (ink), footer, preheader, venue-address/phone row, bulletproof primary CTA (via `<!--[if mso]>`), plain-text block, all inline-styled, `color-scheme: light` + explicit bgs so forced-dark doesn't destroy it.
  - **Preview harness** — `sp_be/scripts/render-emails.js` renders all fixture emails to `.scratch/emails-preview/*.html` (gitignored) for real mail-client eyeballing.
- **Wire-up** (sp_be/utils/notificationCatalog.js): subjects read `brand_name`; **player booking emails** (confirm, reminder, bill, player-cancel) gain **preheader & plain-text** + **venue row** (name, city, phone); **confirm + reminder** gain **inline CID QR** (`qr_token` → `qrcode` lib → `cid:booking-qr.png`), microcopy *"Single-use check-in code — don't forward this email"*; bill keeps PDF QR + gains inline too; owner/admin emails keep the existing content, shell only.
- **Email service** stays thin (`sendEmail` only); builders move to the new pure module.

### Subject personalization

`booking.confirmed` / `booking.reminder` / `booking.cancelled.player` subjects gain the player's first name (`player_name`): `"Kasun, your court at Smash Arena is booked"` etc; fallback to generic when absent.

### Data

`bookingLoader.js`: add `v.address`, `v.city`, `v.phone` to the load payload (venue-contact). Walk-ins already carry the venue's correct address (they're going to the venue, not a profile). Token QR: `loadQrToken(bookingId)` — one explicit, dedicated load used ONLY by player-facing email builders, with `assert(to === booking.user_email)`; the shared booking payload never carries `qr_token` (CONTEXT). Events: no token exists → no QR anywhere on event emails (intentional; events grow a QR later, the plumbing is already here).

## Done criteria

- [ ] All 17 fixture emails render via `render-emails` harness and look premium in AppleMail + Gmail (paper/ink/green, header wordmark, CTA button, no web-fonts).
- [ ] `.env.example` + globs: `FRONTEND_URL` documented (CTAs); preview dir gitignored.
- [ ] Player booking emails (confirm/reminder/bill/player-cancel) contain: brand, preheader, venue address/phone, CTA → `FRONTEND_URL/bookings`, inline QR (single-use warning), plaintext block. Owner emails: shell only, no player data.
- [ ] Event emails: full shell + event block + CTA; **no QR**.
- [ ] `bookingLoader` supplies venue phone/address; `player_name` personalization available in the catalog.
- [ ] `notificationCatalog` + `emailService` tests green; new pure-`emailTemplates` unit tests green; full suite green.
- [ ] ADR-0024 + `CONTEXT.md` QR Token disclosure wording + **Booking Alert** owner-side term recorded.
- [ ] No schema change/migration needed (QR audit lives in the existing `outbound_messages` table).

## Comments

- Grill Q18: no venue-scoped "QR" on events (intentional; no check-in entry flow).
- ADR-0024 recommended (QR token now reachable in the player's own transactional inbox, single-use; matches the existing bill-PDF precedent); Booking Alert first added in the earlier catalog round — not changed here.
- Neutral-neutral: subjects are built in the catalog (`notificationCatalog.js`), so subject friction owns personalization; the catalog's `player_name` comes wired through this contract. Existing owners diverge; the ownership term was set in the earlier grill round.
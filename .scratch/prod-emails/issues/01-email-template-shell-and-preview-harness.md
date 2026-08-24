# 01 — Email template shell + preview harness

**What to build:** the shared prod-grade table email shell + the render-all preview script.

**Depends on:** spec

**Status:** ready-for-agent

**Seam:** pure module, no DB.

- [ ] New `sp_be/utils/emailTemplates.js` — pure functions, no `require('../db')`:
  - `shell({ content, brand, preheader, ctaText, ctaHref, venueRow, plainText })` → full HTML.
  - Table-based (Outlook), explicit cell backgrounds, `color-scheme: light`, system font stack.
  - Header: wordmark — `brand` split into two-tone (green "MySlot" / ink ".LK" via config `brand_name`, fallback friendly split); no web fonts.
  - Footer: reusable (help/contact line, unsub-note n/a for transactional, small print).
  - Bulletproof CTA (`<!--[if mso]>` VML + table button) centred.
  - `preheader` hidden span (display:none + mso-hidden).
  - Plain-text: same content, line-broken, in a `<!--plaintext-->`/`<pre>` block or used by the transport as the `text` body.
- [ ] `.scratch/emails-preview*` added to `.gitignore` (sp_be/.gitignore or root).
- [ ] New `sp_be/scripts/render-emails.js` — prints all 17 fixture emails to `.scratch/emails-preview/<key>.html` + a `index.html` grid, runnable `node sp_be/scripts/render-emails.js`. Fixture data inline (booking, event, owner-plan, lead).
- [ ] `emailService.js` unchanged in this ticket beyond import of new shell-builders (actual builder migration is 02).
- [ ] Tests: shell renders `<!DOCTYPE>`, contains preheader span, CTA href, no external web-font `<link>`; escapes brand/content.
- [ ] `npm test` green.

## Comments

Contract: shared shell, Outlook `table` layout, no web fonts, `color-scheme: light` (no dedicated dark styles in v1 per grill Q9).
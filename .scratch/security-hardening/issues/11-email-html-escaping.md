# 11 — Email HTML escaping

**What to build:** neutralize stored-XSS into transactional emails.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- `utils/emailService.js:50-97` builds HTML templates with template literals interpolating user-sourced strings (venue name, player name, booking refs).
  - Add a single `escapeHtml` helper (`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`) and apply it to **every** interpolated user-sourced value in all email templates (confirmation, reminder, venue approved/rejected).
  - Server-controlled values (dates, amounts already formatted, URLs) may pass through but escape anyway when cheap.
- Do not introduce a templating engine for this; keep the current template structure.
- Verify SMS templates are plaintext (no HTML context — nothing to escape; confirm code/smsService don't build HTML).

## Verification

- Vitest: booking confirmation with player name `<img src=x onerror=alert(1)>` — rendered HTML contains `&lt;img` and no raw `<img`; smoke test all template types share the helper.
- Grep: no template literal in `emailService` interpolates a raw user var without the helper.

## Done criteria

- [ ] `escapeHtml` helper; applied to every user-sourced bound value.
- [ ] Test asserts malicious names render inert.
- [ ] All existing email flows unchanged in shape.
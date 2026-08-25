# 08 — Owner console: Widget & Page section

**What to build:** the owner's self-serve surface for the off-platform story. Per venue: brand editor (name, tagline, colors — primary/secondary, logo, cover photos, about text) with a preview that renders as the branded page will look; domain allowlist add/remove; a copy-paste embed snippet; and an independent widget on/off toggle (separate from marketplace visibility). Admin can override brand/pages.

**Blocked by:** 02 (key + allowlist), 06 (page it previews), 07 (snippet target).

**Status:** ready-for-agent

- [ ] Brand editor saves brand tokens per venue; defaults shown until set
- [ ] Live preview of the branded page; console preview matches the public page
- [ ] Domain allowlist management UI (already backed by 02)
- [ ] Copy-paste embed snippet (`<iframe>` pointing at `embed/<key>`)
- [ ] Widget on/off toggle; toggle respected by the embed route

- [ ] Tests: brand save + preview match; snippet contains the right key; toggling off blocks embed while keeping marketplace unaffected
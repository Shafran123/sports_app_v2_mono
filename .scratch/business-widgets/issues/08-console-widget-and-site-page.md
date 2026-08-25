# 08 — Owner console: "Widget & site" page replaces per-venue tab

**What to build:** The owner console's Widget & page tab (`apps/admin/src/features/admin-venues/widget-page-editor.tsx` mounted in the venue detail page) is replaced by a top-level **Widget & site** page operating on the Business.
- New page + route (e.g. `apps/admin/src/app/(shell)/widget-and-site/page.tsx` or an entry in the existing shell nav): sections:
  1. **Business** — name + brand editor (colors, logo URL, tagline, about) via `GET/PATCH /business/me` (02)
  2. **Widget instances** — table: name, key (copyable), default venue, "choose venue" toggle, domains count, enabled, actions (edit / disable / delete). Create-instance form: name, default venue (dropdown of eligible venues), allow-venue-choice toggle, allowed domains (existing chips/editor from the old tab). Per-instance CTA: "Copy embed snippet" copying `<iframe src="http://<FRONTEND_URL>/embed/<embedKey>" ...>` — same snippet builder as today's but keyed per instance (03).
  3. Empty/default states: business with one venue → help text; zero eligible venues → create blocked with a clear message.
- Remove the per-venue "Widget & page" tab from `venue-detail-page.tsx` and delete `widget-page-editor.tsx`; move its domain/chips/brand UI into the new page's components (reuse pieces, per-instance now).
- Delete-instance confirm: warn that existing embeds will stop working; bookings unaffected.
- Console tests: create/edit/delete instance, snippet copy content, brand save, permission errors (owner sees only own business).

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Widget & site page with Business section (name/brand)
- [ ] Instance list + create/edit/delete/disable UI
- [ ] Per-instance domains editor + embed snippet copy
- [ ] Old per-venue tab removed; `widget-page-editor.tsx` deleted
- [ ] Console tests for the new page
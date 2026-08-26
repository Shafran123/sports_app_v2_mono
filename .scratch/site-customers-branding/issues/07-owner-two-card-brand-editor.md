# 07 — Owner Console: two-card brand editor, no preview (ADR 0031)

**What to build:** Restructure the "Widget & site" area into two cards. **Business brand** — business-wide (name, primary/accent colors, tagline, logo, about) shared with the widget. **Site brand** — site-only (hero image upload w/ URL fallback, headline/caption, contact block). The Preview button is removed. Logo becomes an upload with a URL text fallback, keeping the existing color pickers.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] Business brand card: name, colors, logo (upload + URL), tagline, about; saves via `business.updateMe`
- [x] Site brand card: hero image (upload + URL), headline, contact block (phone/email/address/hours); saves via the same endpoint
- [x] Preview button removed; save feedback kept
- [x] Tests: cards render, hero upload + URL fallback, save round-trips new fields
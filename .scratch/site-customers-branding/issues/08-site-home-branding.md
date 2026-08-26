# 08 — Site home: hero, about, contact, maps link (ADR 0031)

**What to build:** The Dedicated Site portfolio root renders the full **Site Brand**: hero (hero image or fallback, business name, tagline, "Book now" CTA scrolling to venues) → about (extended) → venues grid (auto from venue data: photo, name, address, sports, price-from, each with an auto Google-Maps link generated from `lat`/`lng`, hidden when unset) → contact strip (Site Brand contact block) → footer. Where contact fields are blank, that strip is omitted.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] Hero: hero image (upload/URL), fallback to logo/venue photo when unset, CTA scroll
- [x] About section renders extended about
- [x] Venue cards gain the auto Google-Maps link (from lat/lng), hidden when unset
- [x] Contact strip renders the business contact block when any field set; footer keeps brand + "Powered by" attribution
- [x] `--brand-bg` actually resolves from the brand (today it's a hardcoded fallback in site-chrome)
- [x] Tests: all blocks render from fixture; missing hero/contact gracefully omitted; maps link correct from lat/lng
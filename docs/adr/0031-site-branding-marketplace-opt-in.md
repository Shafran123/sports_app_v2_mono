# 0031 — Site branding, contact, and the marketplace-opt-in model

- **Status:** accepted (dashboard-restructure section superseded by ADR-0035)
- **Date:** 2026-08-26
- **Supersedes in part:** ADR-0029 (site-level presentation listed hero/intro/contact/footer; this ADR defines the fields, the venue-card maps link, and the marketplace cutover rule)

## Context

ADR-0029 gave the Dedicated Site Business brand chrome and site-level presentation. Building it showed the branding surface needs definition: what exactly can an owner set, how is it stored, and — critically — how a business with a live site relates to the marketplace. The strategic aim is now explicit: **the platform's product is white-label sites; the marketplace is a deprioritized fallback.** P0 field feedback asked for hero imagery, owner-editable personalized content, and a Google Maps link on venue cards; owners also want their sites to become the sole booking surface as they take ownership of their audience.

## Decision

- **One shared `brand` JSONB on the Business.** Shared tokens (business name, primary/accent colors, logo, tagline) stay shared with the Booking Widget, plus site-only fields: hero image, hero headline/caption, longer about, contact block (phone, email, address, hours). No separate site brand copy; the widget and site always stay consistent.
- **Hero image is an owner upload** via the existing uploads endpoint (Supabase Storage) with a URL fallback; a single hero image, not a carousel.
- **Site home composition:** hero (image, business name, tagline, "Book now" CTA scrolling to venues) → about → venues grid (auto-generated from venue data: photo, name, address, sports, price-from) → contact strip → footer. Owner edits hero, about, contact; the venues grid follows venue data with no double entry.
- **Venue cards get an auto Google-Maps link** generated from each venue's lat/lng, gracefully hidden when unset; no maps-URL field.
- **The Venue detail page and booking flow render full site chrome and brand colors on the site** — no marketplace look anywhere on the site.
- **Dashboard restructure.** In the existing "Widget & site" console area, two cards: **Business brand** (business-wide: name, colors, logo, tagline, about) and **Site brand** (site-only: hero image, headline, contact). The Preview button is removed. Logo becomes an upload with URL fallback.
- **Marketplace-opt-in model.** When a Business's Dedicated Site goes live, its venues **default off the marketplace** (site-only: visible on the site, hidden from marketplace booking). The owner can per-venue opt **back into** marketplace listing, selling dual-channel (sites and marketplace in parallel). Marketplace-listed venues behave normally for platform Players. The existing per-venue visibility flag governs marketplace discovery.
- **Marketplace itself is untouched and remains a fallback** — the platform-hosted branded pages stay for businesses without sites; the marketplace continues to run as-is with platform identity (see ADR-0030), receiving no new feature investment.

## Trade-offs

- **Shared brand vs per-surface divergence**: one source of truth and zero double entry, at the cost of not letting a business look different-sized on the widget vs the site — accepted since the widget usually renders on the owner's own site.
- **Default-off marketplace vs explicit opt-out**: the flip is automatic at site-live, protecting the owner's audience and their customers' identity, at the cost of a silent booking drop-off if the site isn't ready — mitigated because owners control the toggle per venue and can re-enable immediately.
- **Auto maps link vs owner field**: zero data entry and always-present directions, at the cost of venues with bad/absent coordinates not showing a link (hidden rather than wrong).

## Consequences

- CONTEXT.md: **Site Brand** added, **Marketplace Listing** added (per-venue sell-on-marketplace state, default off when a site is live), **Dedicated Site** amended (site-first onboarding, default-off marketplace, hero/contact, owner-editable blocks), **Booking Widget** (uses Site Customer auth) and **Player** (marketplace-scoped) already amended in ADR-0030.
- Data: an upload/hero field on the business (in `brand` JSONB or a column), business-level contact fields, a marketplace-listing flag on venues (or derived from visibility + site-live).
- Owner console: brand editor restructured into two cards; venue cards' maps link; business-level contact editing.
- Venue detail/booking pages: brand chrome throughout on the site host.
- Marketplace storefront: unchanged except per-venue link-out for site-live venues that are not marketplace-enabled.

## Future trails (unchanged)

- Multi-Business-per-Owner UI; multiple hostnames per site; site home carousel (a later enhancement over single hero); per-venue maps-URL override should lat/lng ever be insufficient.
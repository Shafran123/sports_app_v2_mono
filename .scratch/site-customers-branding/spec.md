# Spec: Site customers + site branding (ADR 0030 + 0031)

The Dedicated Site (ADR-0029) becomes the platform's core product. Two ADRs, accepted 2026-08-26, define the work:

- **ADR 0030 — Per-business customer tenancy**: Site Customers are per-Business identities, our own auth (not Firebase), fully independent across Businesses; bookings reference `site_customer_id`; the widget uses the same site-customer base; owner console gains a Customers directory; onboarding is site-first.
- **ADR 0031 — Site branding + marketplace-opt-in**: one shared `brand` JSONB (colors/logo/tagline shared with the widget; hero image, headline, longer about, contact block site-only); site home = hero → about → venues grid (auto) → contact/footer; auto Google-Maps link on venue cards from lat/lng; venue detail + booking flow fully branded on the site; dashboard split into Business brand / Site brand cards, no Preview button; **venues default off the marketplace when a site goes live**, owner per-venue opt-back-in (Marketplace Listing).

## Scope boundaries

- Firebase stays for platform accounts (Player, Venue Owner, Admin).
- Marketplace itself is untouched (deprioritized, remains fallback).
- Branded Venue Page (`myslot.lk/<slug>`) remains as platform fallback for businesses without a live site.
- Owner-gateway payments (P1/P2), multi-Business-per-Owner, multiple hostnames per site: out of scope, unchanged trails.

## Terminology (glossary)

**Site Customer** — per-Business account; **Site Brand** — site presentation layer in `brand` JSONB; **Marketplace Listing** — per-venue owner-controlled state, default off once the Business's site is live.

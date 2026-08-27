# 0035 — Single Business Brand editor + business-branded transactional messages

**Status:** accepted
**Supersedes in part:** ADR-0031's dashboard-restructure ("two cards: Business brand / Site brand") and ADR-0034's editor references.

## Context

Owners experienced the Business's one `brand` object as two confusing editors: "Business brand" and "Site brand" were adjacent cards on the *Widget & site* page that both wrote to the same storage, with overlapping fields (`about` vs `headline` vs `tagline`; logo vs banner). Separately, transactional email and SMS were branded only to the platform: a hardcoded two-tone wordmark with a fixed green accent (no Business logo, no Business colors), a fixed `MySlot.LK:` SMS prefix, and an env-only sender mask — even for booking messages sent on behalf of a Business.

## Decision

- **One Business Brand editor.** The owner's *Widget & site* console shows a single "Business brand" card with labelled sections (identity, colors, images, contact, social links, site policies) and one save writing the whole `brand` object. Storage is unchanged — one `brand` JSONB shared with the Booking Widget, the Dedicated Site, and now transactional messages.
- **`headline` is retired.** `tagline` (short) and `about` (long) remain; existing `headline` values migrate into `about` where `about` is unset, then the key is dropped.
- **Business-branded email/SMS.** Booking, event, walk-in, and site-domain messages carry the Business's own name, logo (`logo_url`), and colors (`colors.primary`/`accent`): the email header renders the logo (wordmark-in-primary fallback), the CTA/badges take the Business primary, surfaces stay neutral, and the footer keeps the platform attribution. The SMS message prefix becomes the Business name. The SMSGo **sender mask stays environment-configured only** — never derived per Business (masks are provider-registered).
- **Scope.** Business-branded: booking confirmed/reminder/bill/cancelled, owner booking alerts, event registered/cancelled, walk-in, site request status. Platform-branded (no Business context): signup welcome, OTP/verification, venue approved/rejected, owner lifecycle, daily digest.

## Trade-offs

- **One shared brand vs per-surface divergence** (kept from ADR-0031): the widget, site, and messages always agree, at the cost of not letting each surface look different — accepted because consistency is the product.
- **Remote logo image vs inlined CID**: the email logo is a remote `<img>` (clients may block it on first load) because the QR — the one critical inline asset — is already inlined; the wordmark fallback covers blocked images.
- **Primary vs accent**: the email accent is themed from `colors.primary` (header wordmark, CTA, badges); `colors.accent` is carried in the token contract for a second accent color but no current template renders one — the templates stay restrained (accent-neutral) rather than force a second color that would fight the Business's primary.

## Consequences

- CONTEXT.md: **Site Brand** term retired; **Business Brand** becomes the single term covering the shared brand tokens and the site-level presentation fields (site banner, contact, social links, site policies).
- Data: `headline` removed from the brand JSONB (migration 0029 copies into `about`).
- Dispatch plumbing: booking/event loaders join the Business so the message context carries `business_name` + `business_brand`.

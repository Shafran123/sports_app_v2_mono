# ADR-0034 — Minimal one-viewport Dedicated Site home

Status: Accepted

## Context

ADR-0032's revamp shipped a hero carousel home: the Site Gallery drove a full-bleed auto-rotating hero, followed by an intro block, a photo-heavy venue grid, a "Find us" contact card, and the legal footer. Review on `http://mysite.localhost:3000/` found it messy: too much imagery, venue cards overloaded with photos and badges, contact spread across a page section, and no social presence. The owner wants a single-viewport home: logo, business name and description, then the venues as minimal cards — no hero at all.

## Decision

- **One-viewport home.** The page fills 100vh on desktop: the slim header (unchanged, becomes the solid sticky bar since there is no hero to float over), an intro block (business name + description), the "Our venues" heading, then the venue cards. When the cards overflow, the venue region scrolls internally while header + intro stay put; small screens scroll normally. No hero image anywhere on the home.
- **Minimal venue cards.** Each card shows the venue name, its **Open Status** ("Open now"/"Closed now" dot plus today's hours line, computed from the venue's Opening Windows against the visitor's device clock), a Google Maps directions link, and the "from LKR X" price. Dropped from the cards: the photo and the sports badges. With zero approved venues, a muted "New venues coming soon" line stands in for the grid.
- **Find us moves to a modal.** The contact block (phone, email, address, hours) opens in a dialog from a footer link (site-wide), not a page section.
- **Social Links in the footer.** The footer gains optional per-platform URLs — Facebook, Instagram, TikTok, WhatsApp, YouTube — rendered as icons beside the privacy/terms links and the "Booking by" line. Missing platforms don't render.
- **Site Gallery removed.** The `gallery` and `hero_image` brand fields, the home hero carousel, and the admin gallery editor are deleted (a breaking removal — existing owner gallery/hero data is dropped, no migration). `headline`, `about` and `tagline` stay: they feed the description and footer. The SiteCarousel component survives for venue-photo carousels on the venue detail page and the Branded Venue Page.
- **Site Gallery removed.** The `gallery` and `hero_image` brand fields, the home hero carousel, and the admin gallery editor are deleted (a breaking removal — existing owner gallery/hero data is dropped, no migration). `headline`, `about` and `tagline` stay: they feed the description and footer. The SiteCarousel component survives for venue-photo carousels on the venue detail page and the Branded Venue Page.
- **Single-venue behavior unchanged.** With exactly one approved venue the home still auto-redirects to that venue's page.

## Amendment (rev.)

The home was reviewed again and tuned:

- **Site Banner.** A single owner-chosen `banner_image` brand field replaces the "no hero" stance: the home shows it as the top banner through the same SiteCarousel component the venue pages use, with the logo above the business name and the description overlaid. The header is dropped on the home page (the banner carries the account control); venue/booking pages keep it.
- **Find us + Social Links move to the top.** The footer loses the Social Links icons and the "Find us" dialog; a slim bar above the venue list carries the social icons and a "Find us" chip opening the contact dialog. The footer is now pure legal links (Privacy, Terms) + "Booking by" attribution.
- **Desktop rectangle.** The home sits in a centered, side-padded container (max-w-6xl) that reads as a rectangle on desktop while the one-viewport scroll-internal behaviour is kept.
- **Open Status pill.** Cards show a pill — "Open now", "Closing soon" (under 60 minutes to close) or "Closed" — instead of the status-plus-hours line.

Supersedes parts of ADR-0032: the hero/Site Gallery home, the photo-heavy venue cards, and the Find us page section.

## Consequences

- `Brand` loses `gallery` and `hero_image`; gains `social_links` and `banner_image`.
- The site payload gains each venue's Opening Windows so the cards can compute **Open Status** server- or client-side.
- The "Find us" dialog and the footer Social Links are now in the home's top bar.
- CONTEXT.md: **Site Brand** amended (no gallery/hero, gains Social Links and the banner), **Site Gallery** removed, **Open Status** and **Social Links** added, **Site Banner** added.
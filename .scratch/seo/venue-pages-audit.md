# Venue pages SEO audit (apps/user), 2026-10-26. Code review only, no live site checked.

Context: ADR-0045 retired the marketplace; venue pages live on Dedicated Sites (`/<slug>` on the owner's host) and as the `myslot.lk/<slug>` fallback.

## What is already right
- `app/[slug]/page.tsx` and `(shell)/page.tsx` set per-venue/per-site titles server-side and `robots: index` on site hosts; platform subdomains (`*.myslot.lk`) are noindex.
- Fallback slug pages redirect to the site host when a business has a live site.
- Embed route is noindex.

## Findings
### High
1. No `robots.txt` / `sitemap.xml` in apps/user. A Dedicated Site on its own domain has no sitemap, so Google must discover venue pages by crawling. Needs host-aware `robots.ts` + `sitemap.ts` (read `getSiteContext()`; list `/` and each venue slug; platform subdomains: `Disallow: /` and no sitemap).
2. No canonical, `metadataBase`, Open Graph/Twitter or JSON-LD on any venue/site page. Site hosts need `metadataBase` = `https://<host>`, `alternates.canonical`, OG using the business logo/venue photo, and `SportsActivityLocation` schema (name, address, geo, openingHoursSpecification, image, telephone). The data is already in `WidgetConfig`/`SiteConfig`.
3. Site-mode metadata has no `description` (only title + robots). Fallback branch builds a description, the site branch does not. Add one per venue and per site home (venue name, sport, city, "book online").
4. Venue content is client-rendered on sites: `VenueDetailPage` is a client component that loads data with react-query, so the server HTML is a skeleton. Googlebot can render JS but indexing is slower and less reliable. Fix: render name, address, about, court list, hours and photos on the server from the `site.venues` data already fetched, keep availability/booking client-side.

### Medium
5. Retired marketplace routes (`/explore`, `/venues/[id]`, `/events`, etc.) render a "closed" slate with HTTP 200 and no metadata: soft-404 risk and stale index entries. Make them `noindex` at minimum, or redirect to the landing page (301) / return 410.
6. Root layout metadata is stale marketplace copy: title "<brand> - Find Your Game", description "Book courts, join games and discover sports near you." It is the default for any page without its own metadata, which on an owner's site means the platform's wrong branding in titles (e.g. site terms/privacy pages). On site hosts the default should come from the site/business name.
7. Utility routes (`/login`, `/register`, `/dashboard`, `/bookings`, `/profile`, `/notifications`, `/book/*`, `/style-guide`) have no `noindex`. Add noindex (or Disallow in robots) so the owner's site only exposes home + venue pages.
8. Dedicated Site home: `SiteHome` is a client component using query/effect; confirm the server HTML contains the business name, description and venue links (same SSR concern as #4).

### Low
9. The slug fallback uses `redirect()` (307, temporary) to the site host. Permanent (308) tells Google to transfer signals if the site is stable; keep 307 only if sites often go offline.
10. `force-dynamic` + `cache: "no-store"` on every request: fine for correctness, but adds latency to every crawl. Consider `revalidate` of 60-300s for the venue/site config (availability stays client-side).
11. Alt text on venue gallery images: verify it uses venue name + sport rather than "photo".

## Suggested order
1. Host-aware robots.ts + sitemap.ts (#1, #7) and noindex retired routes (#5)
2. Server-render venue core content + description (#3, #4, #8)
3. metadataBase, canonical, OG, SportsActivityLocation JSON-LD (#2)
4. Fix default metadata on site hosts (#6)

## Not verified
No live Dedicated Site on an owner domain was inspected; confirm with `curl` and Search Console once one is live. Whether #4 hurts in practice depends on how fast Google renders the page: test with URL Inspection "View crawled page".

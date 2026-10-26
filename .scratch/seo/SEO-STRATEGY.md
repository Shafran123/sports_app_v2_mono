# MySlot.LK SEO Strategy (drafted 2026-10-26)

Baseline: landing site Lighthouse 97 / 100 / 100 / 100 (mobile), sitemap submitted, homepage indexed, /faq /privacy /terms discovered-not-indexed.
Data caveat: no keyword-volume source is connected (no DataForSEO / Google Ads). Every keyword below is a hypothesis to validate in Search Console once impressions arrive.

> CORRECTION (venue-page audit, same day): ADR-0045 retired the player marketplace. There is no player-facing browse/search, so the sport/city hub pages and "players find venues on myslot.lk" ideas below are DROPPED. Venue SEO now means (a) owner acquisition on the landing site and (b) making each Dedicated Site rank on the owner's own domain, which is a product selling point. See `venue-pages-audit.md`.

## 1. Two audiences, two SEO jobs (superseded by the correction above)
| | Venue owners (B2B) | Players (B2C) |
|---|---|---|
| Surface | myslot.lk landing | Branded Venue Pages `myslot.lk/<slug>`, marketplace |
| Query shape | "court booking software Sri Lanka", "futsal court management" | "futsal court Colombo", "badminton court near me", "book cricket nets Galle" |
| Volume | tiny, high value | larger, local, long tail |
| Win condition | trial sign-ups | bookings via venue pages |

The player side is the larger long-term organic asset: every approved venue is an indexable page. The owner side only needs a handful of strong pages.
Constraint from CONTEXT.md: Dedicated Sites on platform subdomains are noindex by design; owner-hosted domains are indexable. Branded Venue Pages are only the fallback for venues without a live site. So decide which URL is the canonical home for a venue's SEO before building anything (see Risks).

## 2. Competitors (what searches could confirm)
- Bokker: the only clearly Sri Lanka-focused platform found (self-reported via a founder's LinkedIn: 13+ sports, owner dashboard, player discovery). Directly competing for the same owner and player queries. Audit bokker's site next.
- VBS Mobile: has a documented Sri Lanka link (cricket grounds), multi-tenant venue management.
- Global tools (Playtomic Manager from about $38/mo per a third-party listing, Courtzap from EUR49/mo, CourtReserve from $150/mo): relevant for comparison pages, not for local ranking. Prices unverified.
- Gap to exploit: the "your own dedicated website + QR check-in" angle and local payment (PayHere, cash at venue) appear nowhere in the results.
Not found: any Sri Lankan listing/directory dominating "court booking" queries. Needs a manual SERP check from a Sri Lankan IP.

## 3. Site architecture
Owner side (apps/landing):
```
/                      value prop (done)
/pricing               what happens after the free 3 months (highest-priority missing page)
/for/futsal            sport pages: /for/badminton, /for/cricket-nets, /for/tennis, /for/padel
/about  /contact       E-E-A-T, real address already in copy.ts
/compare/bokker        only after pricing is public; keep factual
/blog                  3-5 owner-problem posts (see calendar)
/faq /privacy /terms   exist
```
Player side (apps/user, to verify what exists):
```
/<venue-slug>                      per-venue page (title: "<Venue> - <Sport> court in <Town> | MySlot.LK")
/<sport>/<city>   e.g. /futsal/colombo   hub pages listing approved venues
```
Quality gate: only generate a sport/city hub when it has 3+ approved venues with unique copy; thin hubs are worse than none.

## 4. Schema plan
| Page | Schema |
|---|---|
| Landing (done) | Organization, WebSite, SoftwareApplication |
| /pricing | Offer(s) on SoftwareApplication |
| Venue page | SportsActivityLocation (or LocalBusiness) + PostalAddress + GeoCoordinates + openingHoursSpecification + aggregateRating only if real reviews |
| Hub pages | ItemList |
| Blog | Article + author Person |
Do not add FAQPage for SERP benefit (rich results retired May 2026) and no HowTo.

## 5. Content calendar (owner side, 12 posts max in year 1)
1. How to stop double bookings at a futsal court (WhatsApp vs a booking system)
2. How much does a court booking system cost in Sri Lanka (feeds /pricing; honest numbers)
3. Taking online payments for court bookings with PayHere
4. QR check-in for walk-ins: how it works
5. Your own website vs a marketplace listing: which gets more bookings (differentiator)
6. Case study from the first live venue (needs real data and permission)
Later: sport-specific guides (cricket nets scheduling, badminton court pricing by peak hours).
Rule: no post without a first-hand detail from a real venue; generic software content will not outrank global sites.

## 6. Roadmap
Phase 1 (weeks 1-4): foundation
- Done: robots, sitemap, canonicals, OG, JSON-LD, perf and a11y fixes, Search Console connected
- Request indexing for `/`; build /pricing, /about, /contact; add them to sitemap
- Audit venue pages in apps/user for title, description, canonical, schema, crawlability (it is a client app? check SSR)
Phase 2 (weeks 5-12): sport pages, first 3 blog posts, venue-page schema + hub pages once 3+ venues per city
Phase 3 (months 4-6): Google Business Profile for the Galle office, citations in local directories, outreach to Sri Lankan sports bodies/clubs, comparison page
Phase 4 (months 7-12): case studies, review collection, expand cities

## 7. KPIs (honest targets for a new .lk site with a tiny keyword set)
| Metric | Now | 3 mo | 6 mo | 12 mo |
|---|---|---|---|---|
| Indexed pages (landing) | 1 | 4-8 | 10-15 | 20+ |
| GSC impressions / month | ~0 | 300+ | 2,000+ | 10,000+ |
| Organic clicks / month | ~0 | 10+ | 80+ | 400+ |
| Owner enquiries from organic | 0 | 1-2 | 5+ | 15+ |
| Mobile LCP | 2.4s | <2.5s | <2.5s | <2.5s |
Targets are guesses, not forecasts; replace them with real numbers after 8 weeks of Search Console data.

## 8. Risks
- Canonical ambiguity: the same venue may be reachable on its own domain, a platform subdomain (noindex) and `myslot.lk/<slug>`. Decide the canonical and make the others point to it.
- Branded searches are dominated by "myslot" confusion: check the SERP for "myslot" and "myslot.lk".
- Bokker may already rank for local terms: validate with real SERP checks before investing in hubs.
- Owner-side search volume may be too small to matter; the leading indicator is impressions on the pricing and sport pages by week 8. If under about 100, shift effort to outbound and the player side.

## 9. Next actions
1. Request indexing for `/` in Search Console
2. Audit `apps/user` venue pages (SSR, metadata, schema)
3. Build /pricing (needs the post-trial price decided by the business)
4. Manual SERP check from Sri Lanka for 10 queries; record who ranks

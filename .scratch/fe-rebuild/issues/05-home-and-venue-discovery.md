# 05 — Home and venue discovery

**What to build:** the first wow surface. A Player opens the app and can browse real venues — hero, sport chips, nearby venue cards, and a full Explore screen with filters and pagination.

**Blocked by:** 04 — Player auth and app shell.

**Status:** done

- [ ] Home: hero with a search feel, sport chips (from the live sports endpoint), nearby venue cards (image, name, price, sports, indoor/outdoor), popular sports; shimmer skeletons, error + retry, empty state
- [ ] Explore: filter bar (sport / city / min-max price / indoor) + result grid + pagination; filter state lives in the URL and survives back-navigation
- [ ] Venue imagery: venue photos when present, else the curated sport imagery map, with a gradient + sport-glyph fallback; no placeholder image service
- [ ] Responsive 375 / 768 / 1440; build green
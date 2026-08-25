# 18 — Venue-wide offer shows discounted total + offer details in checkout

**What to build:** A venue-wide offer now visibly reduces the price and shows offer details to the player. The backend already charges the discounted amount; the fix was display-only. The venue page summary badge and "Continue" CTA apply the venue-wide discount (display-only, server-authoritative), and the checkout page shows a "Venue-wide 20% off — you save Rs 300" line with the reduced total on the cash pre-confirmation screen (which previously showed the base total) and the online summary. The server's returned amount remains the authoritative total once checkout responds.

**Blocked by:** None — implemented in this session.

**Status:** ready-for-agent

- [ ] The venue page summary badge and CTA show the venue-wide-discounted total when an offer is active.
- [ ] The cash pre-confirmation screen shows the reduced total (not the base) and a "Venue-wide … off — you save Rs X" line.
- [ ] The online summary shows the same offer line alongside the server total.
- [ ] With no venue-wide offer, no offer line renders and the base total shows.
- [ ] Regression tests cover all of the above (backend: checkout charges discounted amount; frontend: offer line + reduced total, no-offer case, `applyVenueOffer` math).

## Context / cause

Root cause was display, not pricing: the cash checkout screen renders before the server responds (`result.amount` is null), so it fell back to the URL base total and never surfaced the venue-wide offer. Verified with a red-capable probe (20% venue-wide → checkout returns 1200; the UI still showed 1500).
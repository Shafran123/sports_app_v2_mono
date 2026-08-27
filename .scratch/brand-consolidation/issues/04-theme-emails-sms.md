# 04 — Theme booking emails/SMS with Business brand

**What to build:** Booking-scoped emails and SMS look like they come from the Business, not the platform. The SMS message body is prefixed with the Business name; emails render the Business logo in the header with the wordmark recolored to the Business primary color as fallback, and the CTA/badges/links take the Business's primary/accent colors. Businesses with no brand configured keep the current platform-branded look, and the SMS sender mask is unchanged.

**Blocked by:** 02 — Plumb Business brand into message dispatch

**Status:** ready-for-agent

- [x] SMS content prefixed with the Business name; platform brand fallback; sender mask still read from env and never per-Business
- [x] Email header renders the Business logo image when set, else the wordmark in Business primary; CTA/badges/links themed from Business primary/accent; surfaces and ink stay neutral; platform attribution stays in the footer
- [x] Business-branded scope: booking confirmed/reminder/bill/cancelled, owner booking alerts, event registered/cancelled, walk-in, site request status; platform-branded scope unchanged (signup welcome, OTP, venue approved/rejected, owner lifecycle, daily digest)
- [x] Email/SMS tests assert theming from Business brand and platform fallback when unset; render-emails preview shows themed output

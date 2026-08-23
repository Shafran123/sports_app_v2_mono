# 03 — Bills & reports surface the tax split

**What to build:** the two taxes are visible and separately accounted everywhere they surface. The Booking Bill PDF and booking detail itemize base, Platform Tax, and Venue Tax. Admin reports and the daily digest report revenue net of both taxes with the two taxes as separate rows; a zero rate still renders as "Tax not applicable".

**Blocked by:** 01 — Inclusive tax engine

**Status:** ready-for-agent

- [ ] Booking Bill PDF shows base, Platform Tax, Venue Tax, total
- [ ] Booking detail UI shows the same split
- [ ] Admin reports and daily digest show Platform Tax and Venue Tax as separate rows
- [ ] Zero-rate rows render as "Tax not applicable", never 0.00
- [ ] Reports remain net-of-tax, with both taxes excluded from revenue
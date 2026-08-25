# 10 — Booking allowance tally + overflow billing view

**What to build:** the usage record behind the fee. A monthly tally per Owner Plan: all bookings count once (multi-slot = one), walk-in quick-books count, cancelled/refunded excluded. Admin sees per-owner allowance usage vs the allowance and the computed overflow (fee = overflow count × overflow rate, or fee on overflow revenue — decide and state it). Billed off-platform (bank transfer/invoice like Plan fees today) — no collection code, just the accurate record + readout.

**Blocked by:** 09 (the fields/templates).

**Status:** ready-for-agent

- [ ] Tally job/view: monthly bookings per owner, excluding cancelled/refunded; multi-slot counts once
- [ ] Walk-in (quick-book) bookings included in the same tally
- [ ] Overflow computed against allowance; fee amount rule documented (per-booking-count vs on-revenue)
- [ ] Admin view: usage vs allowance, overflow due, invoice/export for bank-transfer billing
- [ ] Tests: tally math across multi-slot/cancelled/walk-in cases; overflow computation; period rollover
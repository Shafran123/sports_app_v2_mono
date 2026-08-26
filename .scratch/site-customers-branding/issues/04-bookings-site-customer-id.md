# 04 — Bookings reference Site Customers (ADR 0030)

**What to build:** `bookings` gains a nullable `site_customer_id`; a Booking references exactly one of `user_id` (platform Player) or `site_customer_id` (Site Customer of the Business the booking is made on). Checkout on the site and widget records the Site Customer; allowance, reporting, check-in, holds, QR, and reminders behave the same regardless of which base the booking belongs to. Walk-in Guest bookings unchanged.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Migration: `bookings.site_customer_id uuid null references site_customers(id)`, check constraint exactly-one-of user_id/site_customer_id allowed (walk-in has neither)
- [x] Checkout paths on site host + widget persist `site_customer_id`
- [x] Booking allowance tally, reporting, check-in, QR, and notifications handle site-customer bookings identically
- [x] Site Customer booking history endpoint for the Customers directory (05) and the site's my-bookings surface
- [x] Tests: site-customer booking lifecycle end to end; allowance counting; no cross-Business data exposure
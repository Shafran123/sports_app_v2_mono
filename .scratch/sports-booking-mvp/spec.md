# MVP: Complete Sports Booking Platform (Booking, Owner Dashboard, Admin, Events)

Status: ready-for-agent

## Problem Statement

People in Sri Lanka currently book sports courts by phone call or WhatsApp, and venue owners run their businesses on paper. An existing prototype (sp_fe + sp_be) got part of the way — players can browse and request bookings, an admin can accept or reject them, and payment is cash-on-booking — but it stopped there: no online payments, no venue-owner self-service dashboard (only admins can add yards), no events, no real availability engine, and several security problems (committed Firebase service keys). The goal is to finish the MVP: a complete booking loop with online payment and QR check-in, a mobile-friendly venue-owner dashboard, an admin panel, and events — all working in a pre-prod environment.

## Solution

A sports venue booking marketplace (brand admin-configurable, default "Spots") for Sri Lanka:

- **Players** discover venues and courts with real-time availability, book slots (10-minute hold during checkout), pay online via PayHere sandbox, get a QR-coded confirmation, and check in at the venue. They can cancel with policy-tier refunds and rebook. They can browse events, register, and pay for tickets.
- **Venue owners** register, submit their venue for admin approval, then manage courts, pricing, opening hours, blocks, bookings (including manual cash bookings), QR check-ins, events, and revenue — all from a mobile-friendly `/business` dashboard.
- **Admins** approve venues, manage users, view bookings and payments, issue refunds, manage events, configure the platform (brand, sports, cancellation tiers, hold duration), and see basic reports.

The stack stays Next.js 15 (frontend) + Express (backend), with persistence moving from Firestore to Supabase Postgres (ADR-0001), Firebase Auth as identity (ADR-0002), and PayHere for payments (ADR-0003). The system runs in pre-prod: Vercel + Railway + a Supabase dev project, no production launch.

## User Stories

### Auth & profile

1. As a player, I want to sign up with email and password, so that I can start booking courts.
2. As a player, I want to sign up with Google, so that I can join without creating a new password.
3. As a player, I want to sign up or log in with a phone number via OTP, so that I can use the platform without email.
4. As a user, I want to log out and back in, so that my session works across visits.
5. As a player, I want to edit my name, phone, and city, so that my profile stays current.
6. As a user, I want to change my password, so that I can keep my account secure.

### Venue discovery

7. As a player, I want to browse venues near my city, so that I can find somewhere to play.
8. As a player, I want to search venues by sport and name, so that I can find exactly what I want.
9. As a player, I want to filter venues by sport, price range, and indoor/outdoor, so that I only see relevant options.
10. As a player, I want to view a venue's details (photos, address, map, amenities, rules, cancellation policy), so that I can decide whether to book it.
11. As a player, I want to see the venue's courts with their sports and prices, so that I know what I can book.

### Booking

12. As a player, I want to see real-time availability for a court (available / held / booked / blocked), so that I don't try to book a taken slot.
13. As a player, I want to select date, time, and duration and see the price before committing, so that there are no surprises.
14. As a player, I want my chosen slot to be held for 10 minutes while I check out, so that it isn't sold to someone else mid-payment.
15. As a player, I want to pay online (card), so that I don't need cash at the venue.
16. As a player, I want a booking confirmation with booking ID and QR code, so that I can check in at the venue.
17. As a player, I want my booking in an Upcoming list, so that I can keep track of it.
18. As a player, I want to cancel a booking and get a refund per the policy (more than 24h: 100%, 12–24h: 50%, under 12h: 0%), so that I'm not stuck paying for a slot I can't use.
19. As a player, I want to see past and cancelled bookings, so that I have a complete history.
20. As a player, I want to rebook the same court quickly, so that recurring play is easy.
21. As a player, I want booking reminders (24h and 2h before) by email and push, so that I don't forget my game.

### Events

22. As a player, I want to browse upcoming events near my city, so that I can find activities to join.
23. As a player, I want to view an event's details (sport, date, time, venue, capacity, price), so that I can decide to join.
24. As a player, I want to register for an event and pay online, so that my spot is guaranteed.
25. As a player, I want a ticket with QR code after registering, so that I can be admitted to the event.
26. As a player, I want to see my event registrations, so that I can track them.
27. As a player, I want a full refund if the organizer cancels the event, so that I never lose money on a cancelled event.
28. As a player, I want to see that an event is full, so that I don't try to register for a sold-out event.

### Notifications

29. As a user, I want an in-app notification list (booking confirmed, cancelled, event updates, approvals), so that I have a record of everything.
30. As a user, I want push notifications for the same events, so that I'm informed even outside the app.

### Venue owner — onboarding

31. As a venue owner, I want to register and submit my venue (business details, address with map pin, photos, sports, courts with prices), so that it can be listed.
32. As a venue owner, I want an email when my venue is approved or rejected, so that I know my status.

### Venue owner — operations

33. As a venue owner, I want a dashboard overview (today's bookings, today's revenue), so that I can run my day at a glance.
34. As a venue owner, I want to add, edit, and archive courts (sport, name, capacity, price per slot, slot duration, indoor/outdoor), so that my offering matches reality.
35. As a venue owner, I want to set venue opening hours, so that players can't book outside them.
36. As a venue owner, I want to block slots (e.g. maintenance), so that they don't get booked.
37. As a venue owner, I want a calendar view of bookings (day/week), so that I can see what's coming.
38. As a venue owner, I want to view booking details, cancel a booking, and mark a booking as no-show, so that I can manage my day.
39. As a venue owner, I want to create a manual booking marked as cash-paid (e.g. a phone caller), so that walk-ins don't double-book a slot.
40. As a venue owner, I want to scan a booking's QR code with my phone and confirm check-in, so that arrivals are validated.
41. As a venue owner, I want a revenue summary (today / this month), so that I know how the business is doing.
42. As a venue owner, I want to create events for my venue, so that I can sell registrations.
43. As a venue owner, I want to see my event's registrations, so that I know who's coming.
44. As a venue owner, I want to cancel my event and have players refunded automatically, so that I can manage changes honestly.

### Admin

45. As an admin, I want a dashboard with platform metrics (users, venues, bookings, revenue), so that I can monitor the platform.
46. As an admin, I want to review venue submissions and approve or reject with a reason, so that only real venues go live.
47. As an admin, I want to search and view users and suspend or restore accounts, so that I can moderate the platform.
48. As an admin, I want to view all bookings, so that I can resolve disputes.
49. As an admin, I want to view payments and issue refunds, so that money flows correctly.
50. As an admin, I want to view and cancel events, so that I can enforce platform rules.
51. As an admin, I want reports (revenue by day, bookings by day, active users), so that I can understand growth.
52. As an admin, I want to configure the brand name, sports catalog, cancellation policy tiers, hold duration, and advance booking window, so that business rules live in configuration, not code.

## Implementation Decisions

- **Rename domain terms**: the prototype's "Yard" and "subYard" become "Venue" and "Court" everywhere (see `CONTEXT.md` for the full glossary). Firestore data is not migrated; the platform reseeds fresh (pre-prod has no real users).
- **Data layer**: Supabase Postgres via migrations. Core tables: `users` (firebase_uid, role), `sports`, `venues`, `venue_sports`, `courts`, `venue_hours`, `blocks`, `holds`, `bookings`, `payments`, `events`, `event_registrations`, `notifications`, `platform_config`. Money is integer LKR.
- **Availability is server-authoritative**: availability is derived on the API from venue hours, blocks, holds, and bookings. A Postgres exclusion constraint on `bookings` (court, date, time range) makes double-booking impossible; booking creation runs in a transaction and is keyed by a client idempotency key.
- **Hold lifecycle**: checkout creates a hold (10 minutes, configurable) that renders a slot unavailable. Hold expires → slot released. Payment success → hold converts to a confirmed booking. Payment failure/expiry → hold released. A player re-entering checkout extends/replaces their hold.
- **Booking state machine**: `HELD → CONFIRMED → CHECKED_IN → COMPLETED`, with `CANCELLED` (player, venue, or admin) from CONFIRMED, and `NO_SHOW` when a confirmed booking's slot passes without check-in.
- **Payment states**: `PENDING → PAID → REFUNDED`, plus `FAILED`. Payments are keyed by the PayHere payment id; the webhook is HMAC-verified and idempotent (a replayed webhook must not double-confirm).
- **Cancellation tiers** live in `platform_config` (defaults: >24h = 100%, 12–24h = 50%, <12h = 0%), computed at cancellation time. Rescheduling is out of scope: players cancel (refund per tier) and rebook.
- **QR check-in**: the booking/ticket QR encodes the booking ID; the check-in endpoint validates venue, date, time window (±30 minutes), and state, then moves `CONFIRMED → CHECKED_IN`. Scanning happens in the mobile `/business` dashboard using the device camera.
- **Auth**: Firebase Auth (email/password, Google, phone OTP); the Express API verifies the Firebase JWT, upserts the `users` row, and enforces RBAC (Player / Venue Owner / Admin) per route.
- **API**: Express REST under `/api/v1/*`, consistent envelope `{ success, data, meta }` and error codes like `BOOKING_SLOT_UNAVAILABLE`. Booking-relevant endpoints: venues, courts, availability, bookings, payments, events, registrations, notifications, admin.
- **Realtime**: Supabase Realtime (or polling fallback) keeps owner/admin booking views live, replacing the old Firestore `onSnapshot` behavior.
- **Notifications**: a `notifications` table feeds the in-app list; Resend sends email; FCM sends push. Triggers: booking confirmed, cancelled, reminders (24h/2h), venue approval, event cancelled.
- **Frontend**: Next.js 15 App Router in sp_fe. Route groups: player app (bottom-tab mobile nav: Home, Discover, Bookings, Profile), `/business` dashboard (mobile-friendly), `/admin`. Design system: court-green primary with lime accent, white base, bold condensed headings, rounded cards, full-bleed imagery — per the approved design direction. Brand name and accent come from `platform_config`.
- **Seeding**: 18 sports (badminton, football, cricket, basketball, volleyball, table tennis, tennis, swimming, futsal, gym/fitness, padel, pickleball, squash, golf, martial arts, yoga, running, cycling), sample venues/courts/events, and admin/owner/player accounts, via a seed script.
- **Booking defaults**: 60-minute default slot duration (per-court configurable), 14-day advance booking window, 10-minute hold — all configurable.
- **Security debt from prototype**: Firebase service-account keys must be rotated and removed from git history; committed log files deleted; dead IBAN/bank code stripped; the frontend's hardcoded Firebase fallback config removed; FE `.env.example` added. Secrets only via environment variables.
- **Pre-prod**: Vercel (FE) + Railway (BE) + Supabase dev project, wired via env vars. PayHere sandbox credentials. No production launch.

## Testing Decisions

- **What makes a good test**: exercise external behavior only — the HTTP API and the PayHere webhook handler — asserting on responses and database state, never on internals. Tests run against an isolated Supabase dev project with transactions/cleanup per test.
- **Modules tested**: booking creation (concurrent double-booking must fail), hold expiry (slot returns to availability), webhook idempotency (replayed webhook does not double-confirm or double-refund), cancellation tier math, event capacity enforcement, QR check-in validation window.
- **Prior art**: none — the prototype has zero tests; this establishes the harness (Vitest + Supertest).
- **UI testing**: out of scope for the MVP; verified manually in pre-prod.

## Out of Scope

Games and player matching, groups/communities, chat, coaches and academies, tournaments (brackets/teams/leagues), reviews and reputation, wallet and loyalty points, memberships, coupons and promotions, recurring bookings, corporate sports, multi-branch venues, venue staff accounts, WhatsApp/SMS notifications, SEO landing pages, native mobile apps, the onboarding wizard, dynamic/peak pricing, payouts and commissions, multi-currency, full rescheduling flow, i18n, production deployment.

## Further Notes

- The prototype's admin accept/reject booking flow is replaced by online payment + holds; admin approval applies to venues, not bookings.
- Events are deliberately simple (no brackets or teams); organizers are venue owners or admins.
- The booking engine is the foundation everything else hangs off — correctness of holds, constraints, and webhooks comes before any UI polish.
- Design reference: "SmashZone Badminton Booking Mobile App" (Dribbble) — court-green + lime, classy, mobile-first for both player and owner surfaces.

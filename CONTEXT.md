# Spots — Sports Booking Marketplace

A multi-sided marketplace where players book courts at venues, venue owners run their facilities, and admins oversee the platform. MVP focused on Sri Lanka. Brand name is admin-configurable (default "Spots").

## Language

**Venue**:
A sports facility that lists courts for hire. Has an owner, address, photos, opening hours, and a cancellation policy. Lifecycle: pending → approved → (rejected / suspended / banned / archived).
_Avoid_: Yard, facility, arena

**Venue Suspension**:
A temporary, reversible admin action that hides a Venue from the marketplace and blocks new bookings, while letting existing confirmed bookings play out.
_Avoid_: block, takedown

**Venue Ban**:
A permanent admin action that revokes the owner's console access and makes all of that owner's venues unbookable.
_Avoid_: delete, terminate

**Court**:
A bookable playing area within a Venue (badminton court, football turf, cricket nets). Has a sport, capacity, pricing, and a configurable slot duration.
_Avoid_: subYard, turf, field

**Slot**:
A bookable time segment of a Court on a given date.
_Avoid_: session

**Hold**:
A temporary claim on a Slot while a player is in checkout. Expires after a fixed window and releases the Slot back to availability.
_Avoid_: pending booking, reservation

**Booking**:
A paid reservation of one or more consecutive Slots on a Court. Carries an ID and QR code.
_Avoid_: order, purchase
_Note_: A booking has a payment method (online via PayHere, or cash collected at the venue). See **Payment** below.

**QR Token**:
A random, secret, single-use string minted when a Booking is created. Encoded in the player's check-in QR code; the venue consumes it by scanning and checking in. Re-scanning a consumed token returns "already used."
_Avoid_: ticket number, booking ID (the Booking UUID is NOT the QR token)

**Payment**:
A recorded transfer of money for a Booking or Event Registration. Online payments come from PayHere; cash payments are recorded by the Venue Owner when collected. Status: pending / paid / failed / refunded. Cash payments never sit in pending — the owner records them as paid on collection.
_Avoid_: payment intent (don't reuse for unpaid holds)

**Cash Payment**:
A Payment with method cash, recorded by the Venue Owner when the player pays at the venue. Distinct from an online Payment; it is the source of truth for "was this booking actually paid."
_Avoid_: COD (wrong shipping framing), walk-in payment (the walk-in may still book online)

**Check-in**:
The act of a venue confirming a Booking on arrival by scanning its QR code and consuming the QR Token. Possible from booking creation until shortly after the slot ends; can happen early (walk-ins arrive before their slot).
_Avoid_: attendance

**No-show**:
A confirmed Booking whose slot passed without check-in or cancellation.

**Cancellation**:
Player-initiated termination of a Booking before its slot; refunded per policy tiers.

**Event**:
A one-off sports activity (date, time, capacity, price) created by a Venue Owner or Admin. Sells registrations like tickets.
_Avoid_: tournament, fixture

**Event Registration**:
A paid ticket for an Event.
_Avoid_: event booking

**Player**:
An end user who browses, books, and registers.
_Avoid_: user, customer, member

**Venue Owner**:
An operator account that manages one or more Venues.
_Avoid_: partner, vendor, host

**Walk-in Guest**:
A player without a Spots account who books via the venue's quick-book POS. The booking carries name and phone instead of a user_id.
_Avoid_: anonymous booking, off-book

**Admin**:
Platform staff with full oversight over users, venues, bookings, payments, events, and configuration.

**Booking Reminder**:
An Email Notification sent ahead of a Booking's slot (one day before) to prompt the Player. Distinct from the Booking Confirmation sent at creation.
_Avoid_: reminder booking

**Email Notification**:
A transactional email about a domain event — signup welcome, booking confirmation, booking reminder, venue approved/rejected. Sent fire-and-forget via Mailgun; never blocks the request.
_Avoid_: marketing email, newsletter

**SMS Notification**:
A transactional SMS about a Booking — sent only on **booking confirmation** and **admin-initiated cancellation** (via SMSGo.lk). Not used for marketing or reminders.
_Avoid_: broadcast SMS, promo SMS

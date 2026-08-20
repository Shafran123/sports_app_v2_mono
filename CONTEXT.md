# Spots — Sports Booking Marketplace

A multi-sided marketplace where players book courts at venues, venue owners run their facilities, and admins oversee the platform. MVP focused on Sri Lanka. Brand name is admin-configurable (default "Spots").

## Language

**Venue**:
A sports facility that lists courts for hire. Has an owner, address, photos, opening hours, and a cancellation policy.
_Avoid_: Yard, facility, arena

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

**Check-in**:
The act of a venue confirming a Booking on arrival by scanning its QR code.
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

**Admin**:
Platform staff with full oversight over users, venues, bookings, payments, events, and configuration.

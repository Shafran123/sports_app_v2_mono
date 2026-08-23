# Spots — Sports Booking Marketplace

A multi-sided marketplace where players book courts at venues, venue owners run their facilities, and admins oversee the platform. MVP focused on Sri Lanka. Brand name is admin-configurable (default "MySlot.LK").

## Language

**Brand Name**:
The admin-configurable display name of the platform (default "MySlot.LK"), shown to Players and Venue Owners on config-driven surfaces. Distinct from the internal package namespace and from the transactional email from-address, which are code-baked.
_Avoid_: product name, brand (bare)

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
A random, secret, single-use string minted when a Booking is created. Encoded in the player's check-in QR code; the venue consumes it by scanning and checking in. Re-scanning a consumed token returns "already used." Disclosed only to the Booking's Player (in their own app) and consumed only by the Venue Owner of the Venue the Booking was made on — the check-in validates ownership of the Venue as well as the identity of the Token. Never surfaced through player-facing or venue-facing read APIs.
_Avoid_: ticket number, booking ID (the Booking UUID is NOT the QR token)

**Payment**:
A recorded transfer of money for a Booking or Event Registration. Online payments come from PayHere; cash payments are recorded by the Venue Owner when collected. Status: pending / paid / failed / refunded. Cash payments never sit in pending — the owner records them as paid on collection.
_Avoid_: payment intent (don't reuse for unpaid holds)

**Cash Payment**:
A Payment with method cash, recorded by the Venue Owner when the player pays at the venue. Distinct from an online Payment; it is the source of truth for "was this booking actually paid."
_Avoid_: COD (wrong shipping framing), walk-in payment (the walk-in may still book online)

**Check-in**:
The act of a venue confirming a Booking on arrival by scanning its QR code and consuming the QR Token. Only the Venue Owner of the Venue the Booking was made on may check it in; the scan validates owner-side ownership as well as the Token. Possible from booking creation until shortly after the slot ends; can happen early (walk-ins arrive before their slot).
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

**Player Suspension**:
A temporary, reversible admin action that stops a Player from creating Bookings, registering for Events, or holding Slots. Existing confirmed Bookings remain valid and Check-in still works.
_Avoid_: block, freeze

**Player Ban**:
A permanent admin action that revokes the Player's sign-in entirely. Distinct from Suspension, which is reversible.
_Avoid_: delete account, deactivate

**Venue Owner**:
An operator account that manages one or more Venues, created through the Owner Onboarding flow (an Admin provisions it, attaches an Owner Plan, and drafts an Owner Agreement). Console access and venue creation are gated on accepting the current Owner Agreement.
_Avoid_: partner, vendor, host

**Owner Lead**:
A person who submitted the public "list your place" form, expressing interest in becoming a Venue Owner. Carries name, email, phone, venue name, city, and an optional message. Triaged by an Admin (new → contacted → converted / closed); converting a Lead pre-fills Owner-account creation. Converting always creates a brand-new Owner account — it never reuses or mutates an existing Player account, even on an email match.
_Avoid_: prospect, partner request, enquiry

**Owner Plan**:
The commercial term attached to a Venue Owner, drawn from an Admin-maintained catalog of plan templates (name, term, price) and applied to an Owner with a start and an end date. Expiring and expired Plans surface to the Admin so renewal can be chased.
_Note_: The launch offer is a **3-month free trial** — an Owner Plan template with a zero price and a 3-month term, marketed on the landing page.
_Avoid_: subscription, contract, pricing tier

**Owner Agreement**:
A sales-agreement document of terms drafted by an Admin for a Venue Owner — generated from a reusable template with per-Owner placeholders (parties, venue, Plan, dates, bank details) and editable per Owner. It is emailed to the Owner and must be accepted before the Owner may use the console; a renewal creates a fresh agreement requiring a fresh acceptance.
_Avoid_: contract, terms of service, sales contract

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

**Phone Sign-in**:
Signing in to a Spots account using a one-time code received by SMS to the Player's phone number (Firebase Auth). Opportunistic — any account seeded this way can later be linked to richer sign-in methods. Distinct from **Phone Verification**: completing a Phone Sign-in does **not** verify the phone.
_Avoid_: OTP login, SMS login (a code is not the sign-in; the phone number is)
_Note_: Distinct from **SMS Notification**, which is an outbound transactional SMS about a Booking.

**Verified Phone**:
A phone number on a Player account proven to belong to that Player by passing an SMS OTP challenge sent by the Spots backend (SMSGo.lk), or by explicit Admin marking. Only a Verified Phone may be used to create court Bookings. A phone typed into a form, or used for Phone Sign-in, is not verified until the challenge completes. Changing the phone number clears verified status until the new number is re-verified.
_Avoid_: confirmed phone, validated phone, trusted number

**SMS Notification**:
A transactional SMS about a Booking — sent only on **booking confirmation** and **admin-initiated cancellation** (via SMSGo.lk). Not used for marketing or reminders.
_Avoid_: broadcast SMS, promo SMS

**Feature Flag**:
An admin-controlled switch in platform configuration that changes Spots backend behavior — e.g. whether a Verified Phone is required to book, whether SMS sends are enabled, or how Events appear to players. Read server-side; never client-trusted.
_Avoid_: toggle, setting, switch

**Event Discovery State**:
The platform-level state controlling how Events appear to players: **Enabled** (listings purchasable), **Coming Soon** (shown as teasers, not purchasable), or **Hidden** (not shown at all). Distinct from an Event's own lifecycle status (active/cancelled).
_Avoid_: event visibility, event mode

**Platform Tax**:
A platform-wide percentage rate, Admin-configurable, applied to Bookings and Event Registrations. All prices are tax-inclusive: the listed price is the total the player pays, and the Platform Tax is split out of it at checkout and snapshotted on the Booking or Registration at creation. A rate of zero is presented as "Tax not applicable" (no 0.00 line).
_Avoid_: VAT, GST, service charge, tax (bare)

**Venue Tax**:
A percentage rate set by a Venue Owner for a specific Venue. Like Platform Tax, it is inclusive: the Owner sets the listed price knowing the split, and the Platform Tax and the Venue Tax are both carved out of that price at checkout and snapshotted separately. The Owner manages their own rate (with a live "what you keep vs tax" readout while setting it); the Admin may view Venue Tax but not edit it.
_Avoid_: owner tax, venue tax rate

**Booking Bill**:
A PDF invoice for a Booking or Event Registration, itemizing base price, Platform Tax, Venue Tax, and total. Emailed on payment and printable on demand. Walk-in Guest bills are printed at the venue, never emailed.
_Avoid_: receipt, invoice slip, statement

**Venue Photo**:
An image of a Venue stored in the public Supabase Storage bucket `venue_images` as an absolute URL in `venues.photos[]`. Uploaded via the backend (authenticated, base64, magic-byte validated) — never written directly by the browser. Removed from the bucket when removed from the venue. A Venue Photo is not sensitive; it is rendered by any client as a plain `<img>`.
_Avoid_: venue image (photo is the canonical term), upload, attachment

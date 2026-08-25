# Spots — Sports Booking Marketplace

A multi-sided marketplace where players book courts at venues, venue owners run their facilities, and admins oversee the platform. MVP focused on Sri Lanka. Brand name is admin-configurable (default "MySlot.LK").

## Language

**Brand Name**:
The admin-configurable display name of the platform (default "MySlot.LK"), shown to Players and Venue Owners on config-driven surfaces. Distinct from the internal package namespace and from the transactional email from-address, which are code-baked.
_Avoid_: product name, brand (bare)

**Business**:
The Venue Owner's public brand and portfolio — the entity that owns the Brand tokens and the Booking Widget Instances. Every Venue belongs to a Business, and a Business is owned by exactly one Venue Owner; a Business aggregates all of that Owner's Venues. Distinct from the **Venue Owner** (the account that manages it) and from the platform **Brand Name** (the platform's own display name).
_Avoid_: brand (bare), company, organization, storefront

**Widget Instance**:
One embeddable booking surface published by a **Business** — carries its own **Embed Key**, a **Default Venue**, a "let customers choose venue" toggle, an allowed-domains list, and an enabled state. A Business may publish several Instances (e.g. one per Venue, or one per marketing page), each pinned to a different Default Venue. Every Instance renders the Business's Brand tokens. Distinct from the Booking Widget capability (the Instance is one deployment of it).
_Avoid_: widget (bare)

**Default Venue**:
The Venue a Widget Instance opens with — preselected in the venue step, and the only bookable Venue when the Instance's venue-choice toggle is off. Must be an approved Venue of the Instance's Business.
_Avoid_: pinned venue, primary venue

**Embed Key**:
The unique identifier of a Widget Instance, used in the embed URL (`/embed/<key>`) and to resolve the Instance's config and scope. Replaces the old per-venue widget key.
_Avoid_: widget key, widget_key (API name)

**Venue**:
A sports facility that lists courts for hire. Belongs to a **Business** (which a Venue Owner account manages), and has an address, photos, opening windows, a cancellation policy, a **Cancel Cutoff**, and an advance-booking horizon. Lifecycle: pending → approved → (rejected / suspended / banned / archived).
_Avoid_: Yard, facility, arena

**Venue Suspension**:
A temporary, reversible admin action that hides a Venue from the marketplace and blocks new bookings, while letting existing confirmed bookings play out.
_Avoid_: block, takedown

**Venue Ban**:
A permanent admin action that revokes the owner's console access and makes all of that owner's venues unbookable.
_Avoid_: delete, terminate

**Private Venue**:
A Venue that is bookable but not discoverable — absent from browse, search, and any in-app surface. Reached only through its own booking widget and its branded venue page (and by its Venue Owner in the console). Governed by a visibility flag the Admin sets when provisioning the venue.
_Avoid_: hidden listing, private listing, ghost venue

**Booking Widget**:
The embeddable booking interface a Venue Owner publishes on their own website (iframe) to sell their Venues' courts to their own audience. Delivered as one or more **Widget Instances** per **Business**, each keyed by its own **Embed Key** and pinned to a **Default Venue** — so one embed always books the intended Venue, or lets the customer choose from the Business's approved Venues; tied to a per-Instance domain allowlist (Owner self-serve) so it only renders where the Owner authorized it. Offered to any Business; required for a Private Venue (that Venue's only public surface). The widget signs the buyer in exactly like the app — email + password or Google (Firebase redirect in the iframe, not popup) — and a Player must hold a **Verified Phone** and a **Verified Email** before the picker unlocks; online payment optional per the Owner's choice, otherwise cash at the venue. The widget exposes the Business's full booking engine (all courts, availability, Variable Pricing, Offers, Closed Dates). When online payments land (P2), the widget uses **embedded checkout** (hosted payment fields inside the iframe), not a redirect, so the flow stays in the iframe and lands back on its success screen.
_Note_: The widget renders the Business's brand with a persistent "Powered by MySlot.LK" attribution, and lets the signed-in Player view and cancel their own bookings for that Venue from inside the embed.
_Avoid_: embed widget, booking iframe, widget (bare)

**Branded Venue Page**:
A white-labeled, public storefront page for a Venue — Business brand (colors, logo, tagline), venue name, photos, about text, court list with live prices, opening hours, and the booking flow — served by the platform at its own URL (`myslot.lk/<slug>`), for venues that want to sell off-platform under their own brand. Brand tokens are Owner-configurable on the **Business** (with platform defaults); prices always render from the venue's Court and Variable Pricing config (never re-entered on the page). Public and indexable on the open web. Offered to any venue; a Private Venue's only public surface.
_Note_: A single **portfolio page** presenting several Venues under one Business is a v2 capability; the MVP is one Venue per page URL.
_Avoid_: venue landing page, microsite, storefront

**Court**:
A bookable playing area within a Venue (badminton court, football turf, cricket nets). Has a sport, capacity, a base price per slot, and a configurable slot duration. The base price is what a slot costs when no Variable Pricing rule applies.
_Avoid_: subYard, turf, field

**Slot**:
A bookable time segment of a Court on a given date.
_Avoid_: session

**Slot-time**:
A day-of-week and start-time position within a Court's recurring weekly schedule (e.g. Saturday 18:00). Distinct from a **Slot**, which is a bookable segment on a concrete date; a Slot's start lands at a Slot-time.
_Avoid_: time slot, hour slot

**Opening Window**:
A contiguous open→close period within a single day during which a Venue accepts bookings (e.g. 09:00–12:00). A Venue may have several Opening Windows per day — e.g. a mid-day closure splits the day into two — and a day with none is closed. Slots must fit entirely inside one Opening Window; they never span across a gap.
_Avoid_: hours slot, time block, window (bare)

**Variable Pricing**:
Court-level pricing that varies by day and time. A Court has a base price per slot; a Slot-time that falls inside a configured day+time window on that Court uses the window's price instead (peak vs off-peak). Not the same as an **Offer** — Variable Pricing sets what the slot costs; an Offer discounts what it costs.
_Avoid_: dynamic pricing, surge pricing

**Offer**:
An owner-configured discount, auto-applied server-side to Bookings (never Event Registrations). Two kinds: **Venue-wide** (a percentage or flat LKR amount off the whole booking) and **Slot-based** (a percentage or flat LKR amount off each matching slot, scoped to one or more Courts by day+time window). Each has optional start/end dates plus an active toggle. Stacking is best-single-per-kind — the best Venue offer plus the best Slot offer, never compounding. Applies to the peak-adjusted price.
_Avoid_: coupon, promo, discount code (no codes exist), voucher

**Closed Date**:
A specific date on which a Venue is closed: no availability is offered and checkout rejects it. One-off dates only — recurring weekly closure lives in Opening Windows. A Closed Date blocks new bookings but never cancels existing ones; the Owner cancels those manually if needed.
_Avoid_: holiday, maintenance day (closed date is the canonical term)

**Hold**:
A temporary claim on a Slot while a player is in checkout. Expires after a fixed window and releases the Slot back to availability.
_Avoid_: pending booking, reservation

**Booking**:
A paid reservation of one or more consecutive Slots on a Court. Carries an ID and QR code.
_Avoid_: order, purchase
_Note_: A booking has a payment method (online via PayHere, or cash collected at the venue). See **Payment** below.

**QR Token**:
A random, secret, single-use string minted when a Booking is created. Encoded in the player's check-in QR code; the venue consumes it by scanning and checking in. Re-scanning a consumed token returns "already used." Disclosed to the Booking's Player in their own app and in transactional emails sent to that player's inbox (booking confirmation, reminder, and bill); never surfaced to Venue Owners or in venue-facing read APIs. Disclosed only to the Booking's Player (in their own app) and consumed only by the Venue Owner of the Venue the Booking was made on — the check-in validates ownership of the Venue as well as the identity of the Token.
_Avoid_: ticket number, booking ID (the Booking UUID is NOT the QR token)
_Note_: For widget bookings the QR is also shown on the widget's success screen and sent by SMS/email to the verified phone/**Verified Email** inbox — a fresh widget Player may never open their own app, but must be able to check in. Phone-only bookings receive only a QR link by SMS, not a rendered QR, which is why the widget requires a Verified Email.

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
Player-initiated termination of a Booking before its slot, allowed only up to the Venue's **Cancel Cutoff**. Online-paid bookings refund per the platform cancellation tiers; cash bookings have nothing to refund.
_Avoid_: refund (cancellation is the act; a refund is a separate consequence)

**Cancel Cutoff**:
The Venue-level setting, in hours before a Booking's start, by which a Player may still self-cancel (default 2 hours). Past the cutoff a Booking can only be cancelled with the Venue Owner, not self-service. Distinct from the global cancellation tiers, which govern refunds, not the self-service window.
_Avoid_: cancel window, cancel-block, cancel deadline

**Verified Email**:
An email address on a Player account proven to belong to that Player by passing an email OTP challenge sent by the backend (or attested by an email provider on Google sign-in). Both the Booking Widget and the app require a Verified Email to create Bookings — the QR must reach an inbox, since a phone-only Player receives only a QR *link* by SMS — and it unlocks email confirmations and reminders. A Google-verified email needs no OTP. Changing the email clears verified status until the new address is re-verified.
_Avoid_: confirmed email, validated email, trusted inbox

**Event**:
A one-off sports activity (date, time, capacity, price) created by a Venue Owner or Admin. Sells registrations like tickets.
_Avoid_: tournament, fixture

**Event Registration**:
A paid ticket for an Event.
_Avoid_: event booking

**Player**:
An end user who browses, books, and registers. Signs in with email+password or Google; on first sign-in completes a details step collecting name, a **Verified Phone**, and a **Verified Email** before the first booking. Both verification attributes gate booking on every surface.
_Avoid_: user, customer, member

**Player Suspension**:
A temporary, reversible admin action that stops a Player from creating Bookings, registering for Events, or holding Slots. Existing confirmed Bookings remain valid and Check-in still works.
_Avoid_: block, freeze

**Player Ban**:
A permanent admin action that revokes the Player's sign-in entirely. Distinct from Suspension, which is reversible.
_Avoid_: delete account, deactivate

**Venue Owner**:
An operator account that manages one or more Venues (grouped under a single **Business**), created through the Owner Onboarding flow (an Admin provisions it, attaches an Owner Plan, and drafts an Owner Agreement). Console access and venue creation are gated on accepting the current Owner Agreement.
_Avoid_: partner, vendor, host

**Owner Lead**:
A person who submitted the public "list your place" form, expressing interest in becoming a Venue Owner. Carries name, email, phone, venue name, city, and an optional message. Triaged by an Admin (new → contacted → converted / closed); converting a Lead pre-fills Owner-account creation. Converting always creates a brand-new Owner account — it never reuses or mutates an existing Player account, even on an email match.
_Note_: The landing page's "Book a demo" CTA submits through the same Owner Lead form and pipeline — a demo request is not a distinct concept.
_Avoid_: prospect, partner request, enquiry, demo request

**Owner Plan**:
The commercial term attached to a Venue Owner, drawn from an Admin-maintained catalog of plan templates (name, term, price, **Booking Allowance**, **Overflow Platform Fee**). Applied to an Owner with a start and an end date. Expiring and expired Plans surface to the Admin so renewal can be chased; when a Plan lapses past a grace period, the Owner's Widget and Branded Venue Page go offline while already-confirmed bookings still play out. A plan change creates a fresh Owner Agreement version the Owner must re-accept on renewal.
_Avoid_: subscription, contract, pricing tier

**Booking Allowance**:
The number of Bookings a Venue Owner's plan entitles them to per period (default per month) at no platform fee, counted across all of that Owner's Venues. One Booking counts once regardless of slot count; every recorded Booking counts (including Walk-in Guest bookings), except cancelled and refunded ones. Part of the Owner Plan template, alongside price and term.
_Avoid_: free bookings, quota, allotment

**Overflow Platform Fee**:
The platform fee percentage applied to Bookings beyond a Venue Owner's **Booking Allowance** in a given period (default 5%). Billed off-platform (bank transfer / invoice) from platform booking data, never deducted from the player's payment. Distinct from **Platform Tax**, which is a government-mandated tax carved out of a Booking's price.
_Avoid_: commission, platform cut, overage fee, service fee

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

**Booking Alert**:
An Email or SMS Notification sent to a Venue Owner about a Booking on their venue (created, cancelled). Distinct from the Player-facing Booking Confirmation — it informs the Owner their venue has business, not the Player that they are booked.
_Avoid_: owner notification, venue update

**Email Notification**:
A transactional email about a domain event — signup welcome, booking confirmation, booking reminder, booking alerts, venue approved/rejected. Sent fire-and-forget via Mailgun; never blocks the request.
_Avoid_: marketing email, newsletter

**Verified Phone**:
A phone number on a Player account proven to belong to that Player by passing an SMS OTP challenge sent by the Spots backend (SMSGo.lk), or by explicit Admin marking. A Player must hold a Verified Phone to create court Bookings — on both the app and the Booking Widget. A phone typed into a form is not verified until the challenge completes. Changing the phone number clears verified status until the new number is re-verified.
_Avoid_: confirmed phone, validated phone, trusted number

**SMS Notification**:
A transactional SMS sent via SMSGo.lk covering the Booking lifecycle — confirmation, updates, cancellation — plus phone OTP verification codes. Not used for marketing.
_Avoid_: broadcast SMS, promo SMS

**Feature Flag**:
An admin-controlled switch in platform configuration that changes Spots backend behavior — e.g. whether a Verified Phone is required to book, whether SMS sends are enabled, or how Events appear to players. Read server-side; never client-trusted.
_Avoid_: toggle, setting, switch

**Event Discovery State**:
The platform-level state controlling how Events appear to players: **Enabled** (listings purchasable), **Coming Soon** (shown as teasers, not purchasable), or **Hidden** (not shown at all). Distinct from an Event's own lifecycle status (active/cancelled).
_Avoid_: event visibility, event mode

**Platform Tax**:
A platform-wide percentage rate, Admin-configurable, applied to Bookings and Event Registrations. All prices are tax-inclusive: the listed price is the total the player pays, and the Platform Tax is split out of it at checkout and snapshotted on the Booking or Registration at creation. A rate of zero is presented as "Tax not applicable" (no 0.00 line). Tax carves out of the **discounted** amount when an Offer applies.
_Avoid_: VAT, GST, service charge, tax (bare)

**Venue Tax**:
A percentage rate set by a Venue Owner for a specific Venue. Like Platform Tax, it is inclusive: the Owner sets the listed price knowing the split, and the Platform Tax and the Venue Tax are both carved out of that price at checkout and snapshotted separately. The Owner manages their own rate (with a live "what you keep vs tax" readout while setting it); the Admin may view Venue Tax but not edit it. With an Offer, the Venue Tax splits out of the **discounted** amount.
_Avoid_: owner tax, venue tax rate

**Booking Bill**:
A PDF invoice for a Booking or Event Registration, itemizing base price, Platform Tax, Venue Tax, and total. Emailed on payment and printable on demand. Walk-in Guest bills are printed at the venue, never emailed.
_Avoid_: receipt, invoice slip, statement

**Venue Photo**:
An image of a Venue stored in the public Supabase Storage bucket `venue_images` as an absolute URL in `venues.photos[]`. Uploaded via the backend (authenticated, base64, magic-byte validated) — never written directly by the browser. Removed from the bucket when removed from the venue. A Venue Photo is not sensitive; it is rendered by any client as a plain `<img>`.
_Avoid_: venue image (photo is the canonical term), upload, attachment

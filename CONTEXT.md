# Spots — Sports Booking Marketplace

A multi-sided marketplace where players book courts at venues, venue owners run their facilities, and admins oversee the platform. MVP focused on Sri Lanka. Brand name is admin-configurable (default "MySlot.LK").

## Language

**Brand Name**:
The admin-configurable display name of the platform (default "MySlot.LK"), shown to Players and Venue Owners on config-driven surfaces. Distinct from the internal package namespace and from the transactional email from-address, which are code-baked.
_Avoid_: product name, brand (bare)

**Business**:
The Venue Owner's public brand and portfolio — the entity that owns the **Business Brand** and the Booking Widget Instances. Every Venue belongs to a Business, and a Business is owned by exactly one Venue Owner; a Business aggregates all of that Owner's Venues. Distinct from the **Venue Owner** (the account that manages it) and from the platform **Brand Name** (the platform's own display name).
_Avoid_: brand (bare), company, organization, storefront

**Business PayHere Credentials**:
The four PayHere fields a Venue Owner supplies for their Business's PayHere **Payment Method** — merchant ID, merchant secret, app ID, app secret (the app pair drives refunds' OAuth). They are the Business's own gateway identity: money lands in the Business's PayHere account, never the platform's. Tenant-scoped: one set per Business, held in Google Secret Manager as a per-Business secret (a new save is a new secret version) — never in Postgres or the deployment env. The merchant/app IDs are not secret and also sit on the Business's Payment Method row (they drive configuration state and UI hints). Distinct from **Platform Secrets** (what the platform runs on) and from the platform gateway's keys (used only for Events and legacy refunds).
_Avoid_: payhere keys, gateway credentials (bare)

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
A Venue that is bookable but not discoverable in marketplace discovery — absent from browse and search. When its Business runs a **Dedicated Site**, the Venue appears on that site and may surface in the in-app storefront as a link out to the site; with no site, it is reached only through its own **Booking Widget** (and by its Venue Owner in the console). Governed by a visibility flag the Admin sets when provisioning the venue.
_Avoid_: hidden listing, private listing, ghost venue

**Booking Widget**:
The embeddable booking interface a Venue Owner publishes on their own website (iframe) to sell their Venues' courts to their own audience. Delivered as one or more **Widget Instances** per **Business**, each keyed by its own **Embed Key** and pinned to a **Default Venue** — so one embed always books the intended Venue, or lets the customer choose from the Business's approved Venues; tied to a per-Instance domain allowlist (Owner self-serve) so it only renders where the Owner authorized it. Offered to any Business; required for a Private Venue (that Venue's only public surface). The widget signs the buyer in as a **Site Customer** of this Business — the same per-business customer base as the **Dedicated Site** (email + password or Google), never the platform **Player** base. A guest browses and selects slots freely; the sign-in or account-creation step happens at the confirm step, and a Site Customer must hold a **Verified Phone** and a **Verified Email** for the booking to be created; payment is by the Business's configured **Payment Methods** — PayHere and/or cash at the venue. The widget exposes the Business's full booking engine (all courts, availability, Variable Pricing, Offers, Closed Dates). PayHere checkout in the widget uses **embedded checkout** (PayHere's Onsite Checkout modal inside the iframe), not a redirect, so the flow stays in the iframe and lands back on its success screen.
_Note_: The widget renders the Business's brand with a persistent "Powered by MySlot.LK" attribution, and lets the signed-in Site Customer view and cancel their own bookings for that Venue from inside the embed.
_Avoid_: embed widget, booking iframe, widget (bare)

**Branded Venue Page**:
A white-labeled, public storefront page for a Venue — Business brand (colors, logo, tagline), venue name, photos, about text, court list with live prices, opening hours, and the booking flow — served by the platform at its own URL (`myslot.lk/<slug>`), for venues that want to sell off-platform under their own brand. Brand tokens are Owner-configurable on the **Business** (with platform defaults); prices always render from the venue's Court and Variable Pricing config (never re-entered on the page). Public and indexable on the open web. Offered to any venue; a Private Venue's only public surface.
_Note_: SUPERSEDED for businesses that run a **Dedicated Site** — the site serves their venue pages on the Business's own **Site Hostname**; `myslot.lk/<slug>` remains only as the platform-hosted fallback for businesses without a live site. A single **portfolio page** presenting several Venues under one Business lives in the Dedicated Site, not here; the MVP is one Venue per page URL.
_Avoid_: venue landing page, microsite, storefront

**Dedicated Site**:
A Business's white-labeled, multi-venue website served on the Business's own **Site Hostname** — the owner's domain (`abc.lk`, apex plus `www.` as one) or a platform subdomain (`<brand-slug>.myslot.lk`). One per Business. Not an iframe: it renders the full app booking flow (site sign-in, checkout, holds, QR, payments per the venue's own capability) wrapped in **Business Brand** chrome and site-level presentation (about, contact, **Social Links**, **Site Banner**, footer) instead of the marketplace shell — the venue detail pages and booking flow carry full site branding too. Serves the Business's own audience of **Site Customers** — accounts are created and verified inside this Business only, never shared with any other Business or with the marketplace **Player** base. Serves a one-viewport portfolio root (banner, name, description, slim contact/social bar, minimal venue grid) and one page per venue at `/<slug>`; a single approved venue skips the root and lands directly on its venue page, and venue switching is a header chooser available only on venue pages. When a Site goes live the Business's venues **default off the marketplace** (site-only); the Owner can per-venue opt back into a **Marketplace Listing** (dual-channel). Owner-hosted hostnames are indexable; platform subdomains are noindex. When the Owner Plan lapses past its grace period, the site serves a branded offline slate while confirmed bookings play out.
_Note_: The landing page markets this to owners as "your own dedicated website" — the product term is Dedicated Site.
_Avoid_: microsite, dedicated page, site (bare)

**Site Hostname**:
The hostname on which a Business's **Dedicated Site** is served — exactly one per Business. Either the owner's own hostname (`abc.lk`, apex and `www.` treated as one and configured together) or a platform-proposed `<brand-slug>.myslot.lk` subdomain (uniqueness-checked). Provisioned through a **Site Domain Request**; while live it is a runtime-trusted origin for the site's surfaces.
_Avoid_: domain (bare), custom domain, host

**Business Brand**:
The Business's single brand identity — name, primary/accent colors, logo, tagline (short) and about (long), the **Site Banner**, a contact block (phone, email, address, hours), **Social Links**, and **Site Policies** — owned by the Business and stored in one `brand` object shared by the **Booking Widget**, the **Dedicated Site**, and the transactional emails and SMS the platform sends on the Business's behalf (booking/event/site messages carry the Business's name, logo and colors; platform-level messages keep the platform **Brand Name**). On the site, brand colors appear on buttons, links and accents, never as a page wash. Distinct from the platform **Brand Name**.
_Avoid_: brand (bare), site theme, website theme, website branding

**Social Links**:
The optional per-platform URLs (Facebook, Instagram, TikTok, WhatsApp, YouTube) a Business publishes for its **Dedicated Site** — stored on the **Business Brand**, edited in the owner's *Widget & site* editor, and rendered as icons in the slim bar above the home's venue grid (moved from the footer). A platform with no URL set is simply not shown.
_Avoid_: socials, social media profiles, follow us

**Site Banner**:
The single owner-chosen image shown as the top banner of a **Dedicated Site** home — stored on the **Business Brand**, edited in the owner's *Widget & site* editor, and rendered through the same photo carousel as the venue pages, with the business logo and name overlaid. Replaced the Site Gallery and hero image. Distinct from a Venue's own photos.
_Avoid_: hero image, banner image (ambiguous), cover image

**Site Policies**:
Per-**Business** legal text — privacy policy and terms & conditions — edited by the Owner in the admin *Widget & site* editor and linked from the **Dedicated Site** footer (`/privacy`, `/terms`). Until the Owner saves their own copy, short platform-authored defaults with the business name substituted are shown. Distinct from the platform's own legal pages.
_Avoid_: legal pages, terms page, privacy page

**Platform Legal Pages**:
The platform's own legal and help pages on the marketing site — Privacy Policy, Terms & Conditions, and FAQ — served from the landing app at `/privacy`, `/terms`, and `/faq`, and linked from the landing footer. Distinct from **Site Policies**, which are per-Business legal text on a **Dedicated Site**.
_Avoid_: legal pages (bare), site policies (the per-Business ones)

**Platform Secret**:
An operator secret the platform itself runs on — platform PayHere keys, Mailgun, SMSGo, OTP HMAC, Supabase service-role key, Firebase service account. Held in the deployment's env configuration (Railway), never the repo; distinct from the per-Business **Business PayHere Credentials**, which are tenant-scoped and live in Google Secret Manager.
_Avoid_: env var (bare), credentials (ambiguous)

**Analytics Consent**:
A visitor's recorded choice — Accept or Reject — on whether analytics may run for their visit, captured before any analytics initialize and withdrawable afterwards. Recorded per origin in local storage (the platform sets no cookies, so no cookie is stored); versioned so a change to the privacy policy re-prompts visitors who previously chose. Covers analytics only; nothing else on the platform is consent-gated. Distinct from **Site Policies** and **Platform Legal Pages**, which are legal text rather than recorded choices.
_Avoid_: cookie banner, cookie acceptance, tracking consent

**Anti-bot Check**:
An invisible risk-score evaluation applied to **Dedicated Site** sign-ins, registrations, and bookings, and to the owner-lead form. A low score escalates the submission to an email-OTP challenge or rejects it rather than hard-blocking the visitor. It never runs inside the **Booking Widget** iframe — the widget is a third-party frame where the evaluation breaks, so it relies on its verified-phone/email gate and rate limits instead.
_Avoid_: captcha (the checkbox kind), reCAPTCHA (the vendor name)

**Marketplace Listing**:
A per-venue, Owner-controlled state deciding whether an approved Venue appears and can be booked on the marketplace (`myslot.lk`). **Defaults off once the Business's Dedicated Site is live** — the Venue then sells only on the site; the Owner may per-venue opt back on to sell dual-channel (site + marketplace in parallel). Venues without a live site keep their marketplace listing by default. Distinct from Venue visibility (private vs public), which governs marketplace *discovery* rather than the site.
_Note_: RETIRED with the marketplace (ADR-0045) — no customer-facing marketplace exists; the Venue sells on its own **Dedicated Site** and **Booking Widget** only.
_Avoid_: marketplace sell-on, web listing

**Site Customer**:
A person with an account inside exactly one Business's tenant — the audience of that Business's **Dedicated Site** and **Booking Widgets**. Accounts are created and verified per Business: the same person who is a Site Customer at one Business holds a separate, independent account (own verification, own history) at another, with no data shared across Businesses. Distinct from the **Player**, whose account is platform-wide. Signs in with email+password or Google; on Google sign-in the backend verifies the Firebase ID token itself, resolves the Business from the site hostname (never from the client), and merges by `google_sub` then by email before creating — so one human holds one Site Customer row per Business. Distinct from the **Venue Owner**, whose Google-facing identity is a platform account that owners never sign in with on customer surfaces. A Site Customer may additionally hold a **Second Factor** on their account; that factor binds to the Site Customer, not to any particular surface — it challenges at sign-in on both the Dedicated Site and the Booking Widget alike.
_Avoid_: account, tenant user, business user

**Second Factor**:
An optional second proof of identity a **Site Customer** enables on their account — a time-based one-time password from an authenticator app — required at every sign-in (email+password and Google alike) once enabled. Voluntary by default; a **Business** may require it for its own Site Customers, and any Site Customer may always enable it themselves. Distinct from **Verified Phone** and **Verified Email**, which are booking-gate attributes rather than sign-in factors. The factor is verified server-side by the platform (never by Firebase); losing it is recovered by the Business's **Venue Owner** or an **Admin**, which also revokes the Site Customer's active sessions.
_Avoid_: 2FA, MFA, two-step verification, TOTP (the mechanism)

**Backup Code**:
One of a fixed set of single-use codes issued when a **Site Customer** enables a **Second Factor**, shown once at enrollment, used to sign in or to disable the factor when the authenticator app is unavailable. Each code is consumed by a single use and the set is regenerable.
_Avoid_: recovery code, one-time password, reset code

**Site Domain Request**:
The owner-initiated, admin-workflow request that provisions a Business's **Site Hostname**. States: requested → approved → dns-pending → verifying → live, or rejected. The owner submits the hostname they want (a `myslot.lk` subdomain or their own host); staff approve, hand over the DNS record to add, and the system verifies it — automated polling plus an owner "I've added it" re-check. Staff-only manual steps (auth-provider authorized domain, hosting-domain configuration) are a checklist inside the request. Rejection carries a reason and the owner may edit and re-request. The owner watches live status in their console; every state change also goes out as an **Email Notification**.
_Avoid_: site request, dns request, hosting ticket

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

**Open Status**:
A derived read on a Venue's present state — shown as a pill on the **Dedicated Site**'s minimal venue cards: "Open now", "Closing soon" (under an hour to the last close) or "Closed" — computed from the venue's **Opening Windows** against the visitor's device clock. Distinct from the venue detail page's "Open today" label, which states the day's hours without a live open/closed verdict.
_Avoid_: open-close, now status, live status

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
A reservation of one or more consecutive Slots on a Court. Carries an ID and QR code. Lifecycle: **pending** (awaiting the owner's confirmation — only used when the Business has **Auto-confirm** off) → **confirmed** → **completed** (set on **Check-in**) — plus terminal states **cancelled_by_user**, **cancelled_by_owner**, **cancelled_by_admin**, **cancelled_auto** and **no_show**. A pending booking still holds its Slots; it can be self-cancelled without cutoff, and may be auto-cancelled by the Business's **Pending Auto-cancel** timer.
_Avoid_: order, purchase
_Note_: A booking has a payment method (PayHere, or cash collected at the venue) and a **Payment** status tracked independently of the booking status. See **Payment** below.

**Auto-confirm**:
A per-Business setting governing how new Bookings are confirmed. When on, a cash booking is **confirmed** at creation and a PayHere booking the moment its payment lands; when off, every booking lands **pending** and the Venue Owner confirms it — cancelling a pending PayHere-paid booking refunds it.
_Avoid_: auto-accept (bare), auto-approve, auto-book

**Pending Auto-cancel**:
The Business-level setting — N hours before a pending Booking's start — after which a still-**pending** Booking is automatically cancelled (`cancelled_auto`), freeing its Slots. Distinct from the Player-facing **Cancel Cutoff** (the window in which the Player may self-cancel a confirmed booking); a pending Booking self-cancels freely. When the auto-cancel fires on a PayHere-paid booking, the payment is refunded.
_Avoid_: auto-expire, pending timeout, pending TTL

**QR Token**:
A random, secret, single-use string minted when a Booking is created. Encoded in the player's check-in QR code; the venue consumes it by scanning and checking in. Re-scanning a consumed token returns "already used." Disclosed to the Booking's Player in their own app and in transactional emails sent to that player's inbox (booking confirmation and reminder; never in bills); never surfaced to Venue Owners or in venue-facing read APIs. Disclosed only to the Booking's Player (in their own app) and consumed only by the Venue Owner of the Venue the Booking was made on — the check-in validates ownership of the Venue as well as the identity of the Token.
_Avoid_: ticket number, booking ID (the Booking UUID is NOT the QR token)
_Note_: For widget bookings the QR is also shown on the widget's success screen and sent by SMS/email to the verified phone/**Verified Email** inbox — a fresh widget Player may never open their own app, but must be able to check in. Phone-only bookings receive only a QR link by SMS, not a rendered QR, which is why the widget requires a Verified Email.

**Payment**:
A recorded transfer of money for a Booking or Event Registration. PayHere payments flow through the Business's own PayHere gateway — its own merchant credentials, never the platform's — and begin **pending**; cash payments are created **due** when the Booking is created and the Venue Owner flips them to **paid** on collection. Statuses: **due** / **pending** / **paid** / **failed** / **refunded**.
_Avoid_: payment intent (don't reuse for unpaid holds)

**Payment Method**:
One of the ways a Business collects money for a Booking — exactly **Cash** or **PayHere** — configured per Business, each independently enabled by the Venue Owner (at least one must be enabled). No provider/method two-level abstraction exists: a method IS the provider. A Booking records its method as `cash` or `payhere` (legacy `online` rows migrated to `payhere`). A PayHere method carries the Business's own merchant credentials (its merchant ID and secret, plus the app ID and app secret used for refunds — the secret held only server-side); Cash carries none. A Payment may additionally record `card` as its collection channel when the Owner takes a card-machine payment for a cash-method Booking at the venue — a recorded channel, not a Bookable Payment Method. Distinct from a single Payment's recorded method and from the platform-level payment kill switch.
_Avoid_: payment provider (bare), gateway toggle, payment option

**Payment Link**:
A PayHere checkout URL minted by the backend for a **Walk-in Guest** booking — carrying the Business's own PayHere credentials — sent to the guest by SMS (via SMSGo) so they can pay by card; the standard notify webhook flips the Payment to paid. Distinct from a walk-in recorded as **card** (terminal collection, no link) and from the embedded Onsite Checkout used in the Booking Widget.
_Avoid_: payment request, pay link, WhatsApp link

**Cash Payment**:
A Payment with method cash, created **due** at Booking creation and recorded **paid** by the Venue Owner when the player pays at the venue. It is the source of truth for "was this booking actually paid". Distinct from a PayHere Payment; may be independent of the booking's **Auto-confirm** state — a cash booking can be confirmed before it is paid, and paid before it is confirmed.
_Avoid_: COD (wrong shipping framing), walk-in payment (the walk-in may still pay by **Payment Link** or card)

**Check-in**:
The act of a venue confirming a Booking on arrival by scanning its QR code and consuming the QR Token. Only the Venue Owner of the Venue the Booking was made on may check it in; the scan validates owner-side ownership as well as the Token. Sets the Booking to **completed**. Possible from booking creation until shortly after the slot ends; can happen early (walk-ins arrive before their slot).
_Avoid_: attendance

**No-show**:
A confirmed Booking whose slot passed without check-in or cancellation.

**Cancellation**:
Termination of a Booking before its slot. Recorded with the canceller so reporting can tell the actors apart: **cancelled_by_user** (Player-initiated, allowed only up to the Venue's **Cancel Cutoff**), **cancelled_by_owner**, **cancelled_by_admin**, or **cancelled_auto** (the **Pending Auto-cancel** timer). PayHere-paid bookings refund per the platform cancellation tiers — including when a pending PayHere-paid booking is cancelled or auto-cancelled (full refund, no tier); cash bookings have nothing to refund. Rows cancelled before this status split were migrated to the legacy value **cancelled**, which nothing new writes.
_Avoid_: refund (cancellation is the act; a refund is a separate consequence)

**Cancel Cutoff**:
The Venue-level setting, in hours before a Booking's start, by which a Player may still self-cancel (default 2 hours). Past the cutoff a Booking can only be cancelled with the Venue Owner, not self-service. Distinct from the global cancellation tiers, which govern refunds, not the self-service window.
_Avoid_: cancel window, cancel-block, cancel deadline

**Verified Email**:
An email address on a **Player** or **Site Customer** account proven to belong to that person by passing an email OTP challenge sent by the backend (or attested by an email provider on Google sign-in). Both the Booking Widget and the app require a Verified Email to create Bookings — the QR must reach an inbox, since a phone-only Player receives only a QR *link* by SMS — and it unlocks email confirmations and reminders. A Google-verified email needs no OTP. Changing the email clears verified status until the new address is re-verified.
_Avoid_: confirmed email, validated email, trusted inbox

**Event**:
A one-off sports activity (date, time, capacity, price) created by a Venue Owner or Admin. Sells registrations like tickets.
_Avoid_: tournament, fixture

**Event Registration**:
A paid ticket for an Event.
_Avoid_: event booking

**Player**:
An end user who browses, books, and registers on the platform's marketplace surface. Signs in with email+password or Google; on first sign-in — which a guest reaches when confirming a booking — completes a details step collecting name, a **Verified Phone**, and a **Verified Email** before the first booking. Both verification attributes gate booking creation on every surface. Platform-wide: a Player's account and history span the whole marketplace, distinct from a **Site Customer**, whose account is scoped to exactly one Business.
_Note_: RETIRED with the marketplace (ADR-0045) — no new Player sign-ups or marketplace bookings; existing Players' bookings play out via email QR, and cancellation is owner/admin-assisted.
_Avoid_: user, customer, member

**Player Suspension**:
A temporary, reversible admin action that stops a Player from creating Bookings, registering for Events, or holding Slots. Existing confirmed Bookings remain valid and Check-in still works.
_Avoid_: block, freeze

**Player Ban**:
A permanent admin action that revokes the Player's sign-in entirely. Distinct from Suspension, which is reversible.
_Avoid_: delete account, deactivate

**Venue Owner**:
An operator account that manages one or more Venues (grouped under a single **Business**), created through the Owner Onboarding flow (an Admin provisions it, attaches an Owner Plan, and drafts an Owner Agreement). Console access and venue creation are gated on accepting the current Owner Agreement.
_Note_: The landing page's marketing copy addresses this audience as "sports facility owners" — the product term remains Venue Owner.
_Avoid_: partner, vendor, host

**Owner Lead**:
A person who submitted the public "list your place" form, expressing interest in becoming a Venue Owner. Carries name, email, phone, venue name, city, and an optional message. Triaged by an Admin (new → contacted → converted / closed); converting a Lead pre-fills Owner-account creation. Converting always creates a brand-new Owner account — it never reuses or mutates an existing Player account, even on an email match.
_Note_: The landing page's "Book a demo" CTA submits through the same Owner Lead form and pipeline — a demo request is not a distinct concept.
_Avoid_: prospect, partner request, enquiry, demo request

**Owner Plan**:
The commercial term attached to a Venue Owner, drawn from an Admin-maintained catalog of plan templates (name, term, price, **Booking Allowance**, **Overflow Platform Fee**). Applied to an Owner with a start and an end date. Expiring and expired Plans surface to the Admin so renewal can be chased; when a Plan lapses past a grace period, the Owner's Widget and Branded Venue Page go offline while already-confirmed bookings still play out. A plan change creates a fresh Owner Agreement version the Owner must re-accept on renewal.
_Avoid_: subscription, contract, pricing tier

**Booking Allowance**:
The number of Bookings a Venue Owner's plan entitles them to per period (default per month) at no platform fee, counted across all of that Owner's Venues. A Booking is counted once it is **confirmed** (a **pending** booking does not count) regardless of slot count; every recorded Booking counts (including Walk-in Guest bookings), except cancelled and refunded ones. Part of the Owner Plan template, alongside price and term.
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
An Email Notification sent ahead of a Booking's slot (one day before) to prompt the Player. Sent only for **confirmed** Bookings — a pending Booking is reminded by the owner's confirmation, not by the reminder job. Distinct from the Booking Confirmation, sent when a Booking becomes confirmed.
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
A computer-generated invoice PDF for a Booking, rendered with the **Business Brand** (logo, name, colors) and business contact details, itemized in a bordered table — per-slot lines when the court's price is uniform across the booking, else a single item line — with Subtotal, Offer discount, Platform Tax and Venue Tax (each with its rate %), and Total, stamped with a per-Business sequential **Invoice Number** when first emitted. Never carries the check-in QR (confirmation and reminder emails do that). Emailed exactly once to the Player when payment is confirmed — cash Bookings when the owner marks them paid, PayHere Bookings at Check-in — and cancelled bookings never carry a bill. Walk-in Guest bills skip email; the customer's phone gets an SMS with a tokenized bill link to download it instead.
_Avoid_: receipt (a receipt has no tax breakdown or invoice number), invoice slip, statement

**Invoice Number**:
The per-Business sequential reference stamped on a **Booking Bill** at first emission (e.g. INV-0001) and persisted on the Booking so the PDF and the owner's Invoices tab show one stable number for the life of the document.
_Avoid_: bill id, reference (bare), receipt number

**Venue Photo**:
An image of a Venue stored in the public Supabase Storage bucket `venue_images` as an absolute URL in `venues.photos[]`. Uploaded via the backend (authenticated, base64, magic-byte validated) — never written directly by the browser. Removed from the bucket when removed from the venue. A Venue Photo is not sensitive; it is rendered by any client as a plain `<img>`.
_Avoid_: venue image (photo is the canonical term), upload, attachment

# 0030 — Per-Business customer tenancy: Site Customers outside the platform auth

- **Status:** accepted
- **Date:** 2026-08-26
- **Supersedes in part:** ADR-0029 (identity on the Dedicated Site was the app flow; now it is per-business)

## Context

Field feedback after P0 established the Dedicated Site as the core product (ADR-0029): owners don't just want a branded storefront, they want **their own audience** — customers who belong to the business, not to the marketplace. Today a single platform-wide account (Firebase, email+password or Google, one `firebase_uid` in `users`) books at every venue: widgets, branded pages, the marketplace. Under that model, a person who creates a MySlot account to book at ABC implicitly shares that identity with every other business on the platform.

The business need: "if I create an account on ABC's site, it must not carry over to XYZ — each owner has its own users." Owners want a customer base they own — the same relationship a local business has with its walk-in clients — and, structurally, isolation: business A's customer list is business A's asset.

## Decision

- **Site Customers are a per-Business identity, separate from the platform Player.** A Site Customer is a person with an account inside exactly one Business's tenant, used only on that Business's surfaces (its Dedicated Site and its Booking Widgets). Accounts, verification, and history never cross between Businesses, and never merge with the platform Player base.
- **Site Customer auth is ours, not Firebase.** Email + password (hashed in our app) with a token session; phone/email OTP verification uses the platform's existing OTP infrastructure; Google sign-in is supported by mapping the Google identity to a per-Business Site Customer profile. Firebase remains for platform accounts: Players, Venue Owners, Admins.
- **Google sign-in for Site Customers uses the one Firebase project only to verify the identity.** The site/widget signs in with Google via the Firebase client SDK purely to mint an ID token (redirect flow inside the iframe, popup blocked). The token is handed to `POST /site-auth/google` (`{site_hostname, id_token}`); the backend verifies it with the Admin SDK, reads `sub`, `email`, `email_verified`, `name` from the verified payload, and resolves the Business from the live site hostname — never from the client. The Firebase token is a throwaway credential on owner surfaces and is never persisted as a session; the Site Customer bearer session is the only credential stored. Merge order per Business: match `(business_id, google_sub)`, else match `(business_id, lower(email))` and link `google_sub` onto the existing row, else create; a `google_sub` already attached to a different email is a genuine conflict and errors. Google's `email_verified` claim satisfies the Verified Email on both create and link; a Verified Phone is still required before booking. This works with the single Firebase account because the project only ever holds Google identities, never customer or business data.
- **Same person, independent accounts per Business.** The same email may hold a fully independent, separately verified Site Customer account at ABC and at XYZ. No shared sessions, no shared history, no shared verification. Re-verification happens per Business (Q8).
- **Widget sign-in follows the same scoping.** A Booking Widget on the owner's own third-party website signs the buyer in as that Business's Site Customer (email+password or Google), transport via bearer token inside the iframe, never the platform Player base. The owner's on-site audience is one customer base across site and widget.
- **Per-Business verification rules apply to Site Customer accounts** — a Verified Phone and Verified Email are required before booking, verified against that Business's tenant (re-verified at every new Business where the person becomes a customer).
- **Data model:** a new `site_customers` table (`business_id`, identity/credentials, verification state, contacts) + a nullable `bookings.site_customer_id`. Platform bookings keep `user_id`; a Booking references exactly one of the two. Walk-in Guest bookings unchanged.
- **Owner console:** a Customers directory (name, email, phone, joined, last booking, bookings count, total spend, search, CSV export).
- **Site-first onboarding.** New Owner onboarding provisions the Dedicated Site by default; marketplace listing is optional afterward.

## Trade-offs

- **Our own auth vs Firebase**: no global-email-uniqueness constraint, so Q7's independence is literal; removes the per-hostname Firebase authorized-domains checklist step from site provisioning. Cost: we own password hashing, session issuance, and account-recovery flows for Site Customers, and two auth systems coexist.
- **No cross-Business identity records**: simplest isolation possible and no shared verifications to leak, at the cost of a person re-entering details and re-verifying at each Business — accepted as the product's intent.
- **Widget bearer-token transport**: cookies don't work inside a third-party iframe, costing extra transport work, in exchange for one consistent customer base per owner.

## Consequences

- CONTEXT.md: **Site Customer** added (and **Player** clarified as marketplace-scoped); **Dedicated Site** + **Booking Widget** amended to carry the per-business customer base.
- Data migration: `site_customers` table, `bookings.site_customer_id`, OTP infrastructure extended for per-Business challenge scoping.
- The site's sign-in/checkout reuses the app booking flow shape but against Site Customer auth; holds, QR, and check-in mechanics unchanged.
- Marketplace accounts (Players, Owners, Admins) are untouched; the marketplace keeps platform identity throughout.
- Future trails unchanged: owner-gateway payments (P1/P2), social sign-in providers beyond Google, Site Customer account recovery/export (GDPR-style data portability tooling).
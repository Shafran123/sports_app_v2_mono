# ADR-0033 — Picker-first booking flow: sign-in deferred to the confirm step

Status: Accepted

## Context

The Booking Widget and Branded Venue Page locked the slot picker behind
sign-in plus phone/email verification (ADR-0028, ADR-0030): a guest saw a
"Sign in to book" surface before any slot was selectable. The marketplace
venue page and the Dedicated Site's venue pages did the opposite — a guest
picked slots freely and only met the sign-in wall at checkout. Feedback on
the embed called this out: the sign-in button sat above the slots and the
guest could not select them. The split between surfaces was confusing.

## Decision

Make all three booking surfaces (marketplace, Dedicated Site venue pages,
Booking Widget / Branded Venue Page) follow the same picker-first flow:

- **No identity gate before the picker.** A guest opens the slot picker
  immediately and selects date, duration and slots freely, on every surface.
  The optional header sign-in affordance stays as-is and never blocks.
- **Sign-in deferred to the confirm step.** For a signed-out user the
  summary card's confirm button becomes a sign-in / sign-up affordance; it
  opens the identity flow (sign-in, create account, or Google — the existing
  `WidgetIdentity` surface) in a modal.
- **Return to the same screen, booking auto-creates.** After sign-in /
  account creation the user returns to the same screen with the slot
  selection preserved, the summary now showing "Booking as \<name\>", and the
  booking is created automatically — no second confirm click.
- **Verification still gates booking creation.** A Verified Phone and a
  Verified Email are still required before the booking is created
  (server-enforced `VERIFIED_PHONE_REQUIRED` / `VERIFIED_EMAIL_REQUIRED`);
  the picker itself is no longer the gate.

Supersedes in part: ADR-0028 / ADR-0030's identity-first widget gate
("a Site Customer must hold a Verified Phone and a Verified Email before the
picker unlocks").

## Trade-offs

- **Identity-first vs picker-first.** Identity-first maximized verifiability
  before effort, but cost conversion and consistency — a guest had to create
  and verify an account before knowing what they were booking. Picker-first
  trades a slightly larger identity step later for a frictionless start and
  one consistent flow across all surfaces.
- **Google sign-in reload.** Google sign-in in the iframe uses a page
  redirect, which would lose the in-memory selection. Persisting the guest's
  selection (e.g. localStorage) to survive the reload is deferred — until it
  lands, Google sign-in loses a signed-out guest's picked slots, exactly as
  it does today. Email+password and inline registration keep the selection
  intact.

## Consequences

- `BookPanel` (embed widget + Branded Venue Page) drops its pre-picker
  `ready` gate; the confirm summary gates on identity instead.
- `VenueDetailPage` (marketplace + Dedicated Site venue pages) gains the same
  confirm-step gate: for a guest (or an unverified site customer) the summary
  card's Continue becomes a "Sign in / Sign up to book" / "Verify to confirm"
  button that opens the identity modal, then proceeds to checkout with the
  selection preserved. The checkout-page gate remains as the safety net for
  direct URL access.
- `CONTEXT.md`: **Booking Widget** and **Player** entries updated to the
  picker-first wording; verification still gates booking creation.
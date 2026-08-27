# Brand Consolidation — one owner brand editor + business-branded email/SMS

**Status:** ready-for-agent

## Problem Statement

The owner admin presents the same underlying brand as two separate, confusing editors. In the *Widget & site* console, "Business brand" and "Site brand" are two cards on one page that both edit the same `brand` object on the Business, with duplicated/overlapping fields: an owner fills "About" in one card and "Headline" in the other and only one ever shows on the site; "Tagline" vs "Headline" and the logo vs banner images overlap as well. There is one storage object but two editors with two save buttons.

Separately, transactional email and SMS branding is hardcoded to the platform. Email templates carry a hardcoded two-tone text wordmark with a fixed green accent (no business logo, no business colors), and SMS messages are prefixed with the platform name while the sender mask is a hardcoded env value (`MYSLOT LK`). Booking messages are sent on behalf of a Business, but the Business's own name, logo, and colors never reach them.

## Solution

One **Business Brand** editor in the owner's *Widget & site* console, editing a single `brand` object through one save, with no duplicated fields. Transactional messages that concern a Business's own bookings/events/site carry that Business's branding (name, logo, colors) with platform defaults as fallback; the platform keeps its own identity for platform-level messages.

## User Stories

1. As a Venue Owner, I want one Brand editor in my console instead of two, so that I manage my identity in one place.
2. As a Venue Owner, I want every brand field I edit to be unambiguous, so that I never enter the same thing twice.
3. As a Venue Owner, I want my short tagline and longer About text kept as distinct fields, so that both render where they belong.
4. As a Venue Owner, I want my existing Site brand headline preserved in my About text after the merge, so that I lose no content.
5. As a Venue Owner, I want my logo and my site banner to stay as two clearly-labeled assets, so that I can use a small logo in the header and a wide banner on my site home.
6. As a Venue Owner, I want my business name to prefix SMS messages about my bookings, so that my customers recognize the sender.
7. As a Venue Owner, I want the email confirmations and reminders my business sends to carry my logo and colors, so that they look like they come from my brand.
8. As a Venue Owner, I want my site to look consistent with my brand even before I customize it, via platform defaults, so that nothing looks broken or unbranded.
9. As a Site Customer or Player, I want booking emails that are themed to the venue's Business brand, so that the message is obviously about my booking at that place.
10. As a Platform Admin, I want the platform's own name in platform-level emails and SMS to stay under my control, so that platform identity is separate from Business identity.
11. As a Platform Admin, I want the SMS sender mask to stay environment-configured, so that registered sender IDs are never changed at send time.

## Implementation Decisions

### Merge

- The *Widget & site* console gets **one "Business Brand" editor card** with clearly labelled sections: identity (name, tagline, about), colors (primary/accent), logo, site visuals (site banner), contact (phone, email, address, hours), social links, and site policies. One save button writes the whole `brand` object plus the business name via the existing `business.updateMe` endpoint.
- The underlying storage is unchanged: a single `brand` JSONB on the Business, shared with the Booking Widget and the Dedicated Site. The merge is a UI consolidation, not a data-model change.
- **`headline` is retired.** `tagline` (short) and `about` (long) remain. A one-time data migration copies `headline` into `about` when `about` is unset; when both are set, `about` wins. `headline` is removed from the schema, the backend brand validator, and the site-home description fallback (which becomes `about || tagline`). This is a small blast radius — `headline` is consumed only by the admin editor, the site home description, and backend validation.
- **`logo_url` and `banner_image` remain two distinct assets** — a logo (mark used in widget/site headers) and a single site banner (top of the site home). They are not merged.
- The platform's own **Brand Name** (admin Settings → Brand, the platform wordmark, default "MySlot.LK") is **out of scope** — it is the platform's identity, not the Business's.

### Business-branded email/SMS

- **Plumbing:** the notification dispatch path is extended so that booking/event-scoped dispatches carry the Business context (id, name, and the `brand` object). The booking loader join is extended (`bookings → courts → venues → businesses`) to supply it into the dispatch context handed to the email/SMS builders. Messages without a Business context keep using the platform brand.
- **Email:** the header "logo" renders the Business's `logo_url` image when set, falling back to the two-tone text wordmark recolored to the Business's primary color. The CTA button, badges, and accent links are themed from the Business's `colors.primary`/`colors.accent`; surfaces and ink stay neutral (an email must stay readable regardless of brand). The platform attribution line stays in the footer (from the platform Brand Name). The logo is a remote `<img>` (the QR, the one critical inline asset, is already inlined).
- **SMS:** the message **content** is prefixed with the Business name (fallback to platform brand when a Business has no name); the sender **mask** stays 100% environment-driven and is never changed per Business.
- **Business-branded scope** (has Business context): booking confirmed, booking reminder, booking bill, booking cancellation, owner booking alerts, event registered/cancelled, walk-in, and site domain request status. **Platform-branded scope** (no Business context): signup welcome, OTP/verification, venue approved/rejected, owner lifecycle emails (welcome/renewal/nudge), and the daily digest.

## Testing Decisions

- Only external behavior is tested — a rendered email/SMS string and its theming, not internal builder plumbing.
- Merge: the admin *Widget & site* page widget test asserts one card, its sections, the single save path, and the absence of the retired field; the backend brand sanitize/migration tests are updated (existing coverage in the off-platform and site-domain backend tests).
- Email/SMS: the notification catalog test asserts the dispatch context carries Business brand when present; the email template tests assert logo/wordmark/color theming from Business brand and platform fallback when unset; the SMS tests assert the Business-name prefix and that the mask still comes from env; the render-emails preview harness gains a fixture Business with brand tokens so themed output is human-reviewable.

## Out of Scope

- The platform **Brand Name** admin setting (its own concept, separately governed).
- Changing or per-Business varying the SMSGo sender **mask** (registration-gated, env-only).
- Marketplace storefront branding (ADR-0030 keeps it platform-identity).
- Any change to the shared `brand` storage model, the Booking Widget, or the Dedicated Site rendering beyond the two consumers above.

## Further Notes

- ADR-0031 explicitly chose the two-card editor; this work reverses that dashboard decision. A new ADR records the reversal, and the CONTEXT.md glossary collapses "Business Brand" and "Site Brand" into a single "Business Brand" term (site-level presentation fields stay under it).
- Owner booking alerts are treated as Business-branded (they carry the owner's own Business context via the loader), consistent with the "has Business context → Business-branded" rule.

// The legal pages of a Dedicated Site (ADR-0032): /privacy + /terms render the
// Business's own Site Policies when the owner has saved them, and otherwise a
// short platform-authored default with the business name substituted. On the
// marketplace host the same routes serve the platform's generic copy.

import { getSiteContext } from "@/lib/site-context";

const PLATFORM_NAME = "MySlot";

const PRIVACY_DEFAULT = (name: string) =>
  `At ${name}, we take your privacy seriously.

This site is a booking service run on the ${PLATFORM_NAME} platform. The information you provide — your name, contact details and booking history — is used only to manage your bookings, send you confirmations and communicate with you about your bookings.

We do not sell your personal data. We share it only with ${PLATFORM_NAME} as the technology provider of this booking service, and with the venue owner where it is needed to fulfil your booking.

Your data is stored securely and is kept only for as long as needed to operate your bookings and meet legal obligations.

If you have questions about this policy, please contact the venue directly.`;

const TERMS_DEFAULT = (name: string) =>
  `Welcome to ${name}.

By booking through this site you agree to these terms.

Bookings are subject to availability and to the venue's own rules, cancellation policy and timings. Court prices, availability and hours shown on this site come directly from the venue and may change at any time.

Payments, cancellations and refunds follow the venue's policies, as shown at checkout.

${PLATFORM_NAME} provides the technology behind this booking site but is not a party to your booking with the venue.

If you have questions about these terms, please contact the venue directly.`;

export async function SitePolicyPage({ kind }: { kind: "privacy" | "terms" }) {
  const site = await getSiteContext();
  const name = site?.business.name ?? PLATFORM_NAME;
  const own =
    kind === "privacy" ? site?.business.brand?.privacy_policy : site?.business.brand?.terms_conditions;
  const body = own ?? (kind === "privacy" ? PRIVACY_DEFAULT(name) : TERMS_DEFAULT(name));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
        {kind === "privacy" ? "Privacy Policy" : "Terms &amp; Conditions"}
      </h1>
      <div className="mt-6 space-y-4 whitespace-pre-line text-sm leading-relaxed text-ink-2">
        {body.split("\n\n").map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      {!own && (
        <p className="mt-8 border-t border-border pt-4 text-xs text-ink-3">
          Provided by the booking platform until {name} publishes its own policy.
        </p>
      )}
    </div>
  );
}
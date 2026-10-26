import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@myslot/ui";
import { contact } from "@/lib/copy";
import { PLAN, formatPrice } from "@/lib/pricing";
import { visitorCurrency } from "@/lib/region";
import { SITE_URL } from "@/lib/site";

const PATH = "/compare/own-website-vs-marketplace";
const TITLE = "Own booking website vs marketplace listing: which is better for a sports venue?";
const DESCRIPTION =
  "A fair comparison for Sri Lankan sports venue owners: what you gain and give up with your own booking website versus a marketplace listing, with a checklist of questions to ask any platform.";
const PUBLISHED = "2026-10-26";

export const metadata: Metadata = {
  title: "Own booking website vs marketplace listing for sports venues",
  description: DESCRIPTION,
  alternates: { canonical: PATH }
};

const TABLE: { criterion: string; own: string; marketplace: string }[] = [
  {
    criterion: "Who owns the customer relationship",
    own: "You. Customers sign up on your site, with your brand, and the account belongs to your business.",
    marketplace: "Usually the platform. Check whether you can see, export and contact your customers."
  },
  {
    criterion: "Brand",
    own: "Your name, logo, colours and domain throughout.",
    marketplace: "The platform's brand, with your venue as one listing among many."
  },
  {
    criterion: "Finding new players",
    own: "Only the people you send there: your social pages, Google results, a QR code at the venue.",
    marketplace: "A shared audience already searching for courts. This is the main thing a marketplace offers."
  },
  {
    criterion: "Cost model",
    own: "A flat plan. On MySlot.LK that is a fixed monthly price with unlimited bookings.",
    marketplace: "Varies: listing fees, a commission per booking, or both. Read the terms."
  },
  {
    criterion: "Payments",
    own: "Set up with your own payment account, so the money is yours directly.",
    marketplace: "Often collected by the platform and paid out to you later. Check the schedule and fees."
  },
  {
    criterion: "Setup effort",
    own: "A short setup, then you promote the site yourself.",
    marketplace: "Quick to list, and the platform handles its own promotion."
  },
  {
    criterion: "Search visibility",
    own: "You build your own presence on your own domain, which takes time but compounds.",
    marketplace: "The platform's pages may rank for 'courts near me' searches sooner than a new site."
  },
  {
    criterion: "Control over rules and pricing",
    own: "Your cancellation policy, opening hours, peak and off-peak prices and offers.",
    marketplace: "Mostly yours, within the platform's rules."
  },
  {
    criterion: "Dependency risk",
    own: "Low: the site and customer list are yours.",
    marketplace: "Higher: ranking, fees and rules can change, and you may lose your listing."
  },
  {
    criterion: "Best for",
    own: "Venues with a loyal local base that want to keep customers and margin.",
    marketplace: "New venues that need their first customers fast."
  }
];

const CHECKLIST = [
  "What exactly do you charge: a listing fee, a commission per booking, or both? Is it on the total or the base price?",
  "When and how do I get paid, and who holds the money in between?",
  "Can I see and export my customers' names and contact details?",
  "Can I take bookings and payments that happen outside the platform, such as walk-ins, without a fee?",
  "What happens to my listing and my bookings if I leave?",
  "Do my customers book under my brand, or yours?",
  "Can you change fees or rules, and how much notice do I get?"
];

// Illustration only (invented numbers), in the visitor's regional currency.
const EXAMPLE = {
  LKR: { bookings: 300, each: 4000 },
  USD: { bookings: 300, each: 13 }
} as const;

export default async function ComparePage() {
  const currency = await visitorCurrency();
  const planMonthly = formatPrice(currency, currency === "USD" ? PLAN.usdMonthly : PLAN.lkrMonthly);
  const { bookings, each } = EXAMPLE[currency];
  const revenue = bookings * each;
  const commission = revenue * 0.1;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: TITLE,
        description: DESCRIPTION,
        datePublished: PUBLISHED,
        dateModified: PUBLISHED,
        mainEntityOfPage: `${SITE_URL}${PATH}`,
        author: { "@type": "Organization", name: "MySlot.LK", url: SITE_URL },
        publisher: { "@type": "Organization", name: "MySlot.LK", url: SITE_URL }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Own website vs marketplace", item: `${SITE_URL}${PATH}` }
        ]
      }
    ]
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-3xl px-4 py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
          <Link href="/" className="font-medium text-primary hover:underline">Home</Link>
          <span aria-hidden="true"> / </span>
          <span>Own website vs marketplace</span>
        </nav>

        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{TITLE}</h1>
        <p className="mt-3 text-sm text-ink-3">
          By the MySlot.LK team · Last updated 26 October 2026
        </p>

        <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-ink-2">
          <strong className="text-ink">Disclosure:</strong> we make MySlot.LK, which gives venues their own booking
          website. That makes us biased, so this page also covers what a marketplace does better, and it does not
          name or make claims about any specific competitor.
        </p>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-ink-2">
          <p>
            If you run a futsal court, badminton hall, cricket nets or tennis courts in Sri Lanka, you have probably
            been offered both: a place on a booking marketplace where many venues are listed together, or your own
            booking website under your own name. They solve different problems, and picking the wrong one costs you
            either customers or margin.
          </p>
          <p>
            <strong className="text-ink">The short answer:</strong> a marketplace is good at bringing you strangers.
            Your own website is good at keeping the customers you already have and keeping more of what they pay.
            Most established venues have a regular crowd, and for them the second matters more. A brand-new venue
            with no crowd yet may want both.
          </p>
        </div>

        <h2 className="mt-12 font-display text-2xl font-extrabold tracking-tight text-ink">At a glance</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-surface text-ink">
              <tr>
                <th scope="col" className="p-3 font-semibold">Question</th>
                <th scope="col" className="p-3 font-semibold">Your own booking website</th>
                <th scope="col" className="p-3 font-semibold">Marketplace listing</th>
              </tr>
            </thead>
            <tbody className="align-top text-ink-2">
              {TABLE.map((row) => (
                <tr key={row.criterion} className="border-t border-border">
                  <th scope="row" className="p-3 font-semibold text-ink">{row.criterion}</th>
                  <td className="p-3">{row.own}</td>
                  <td className="p-3">{row.marketplace}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          The marketplace column describes marketplaces in general, not any one company. Terms differ, so always read
          the platform's own.
        </p>

        <div className="mt-12 space-y-4 text-base leading-relaxed text-ink-2">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Customers: who really owns them</h2>
          <p>
            This is the biggest difference and the least discussed. When a player books through a marketplace, they
            become that platform's customer. They know the platform's name, they have the platform's app, and the next
            time they want a court they open the platform and compare you with the venue down the road.
          </p>
          <p>
            On your own website the relationship runs the other way. The player creates an account with your business
            and sees your brand when they book. They come back to you, not to a list of alternatives. With MySlot.LK
            each business has its own customer base, kept separate from every other business, with verified phone and
            email so reminders actually reach people.
          </p>

          <h2 className="pt-6 font-display text-2xl font-extrabold tracking-tight text-ink">Getting found: where a marketplace wins</h2>
          <p>
            Be honest about this one. A new website has no visitors. A marketplace already has people searching for a
            court on a Friday evening, and being listed there can fill a quiet venue in its first months. Your own
            website does not bring that audience on day one.
          </p>
          <p>
            What it gives you is a way to make your existing reach count. Your Facebook and Instagram followers, your
            WhatsApp groups, the QR code on your front desk and your Google Business Profile all point to one place
            where a booking takes seconds. Over time your own domain also builds search presence that belongs to you.
            MySlot.LK sites on an owner's own domain are indexable and come with a sitemap and structured data, but
            search visibility takes months, not days.
          </p>

          <h2 className="pt-6 font-display text-2xl font-extrabold tracking-tight text-ink">Cost: a flat price against a percentage</h2>
          <p>
            Marketplaces differ: some charge a listing fee, some a commission on every booking, some both. A flat plan
            behaves differently, because it does not grow when you do. MySlot.LK costs {planMonthly} a month with
            unlimited bookings, or {PLAN.annualDiscountPct}% less billed annually, after a free first 3 months.
          </p>
          <p>
            To see why that matters, take an illustration with made-up numbers: a venue with {bookings} bookings a
            month at {formatPrice(currency, each)} each takes {formatPrice(currency, revenue)}. If a platform kept 10%
            of that, which is an example and not any platform&apos;s actual rate, that is {formatPrice(currency, commission)}{" "}
            a month. The flat plan is {planMonthly}. The busier the venue, the wider that gap gets. If your own
            bookings are modest, the gap is smaller, and a marketplace&apos;s reach may be worth paying for.
          </p>

          <h2 className="pt-6 font-display text-2xl font-extrabold tracking-tight text-ink">Payments, brand and control</h2>
          <p>
            With your own site you decide your cancellation cutoff, opening windows, peak and off-peak prices and
            offers, and your booking revenue is not collected by us: MySlot.LK never holds it. Marketplaces usually
            let you set prices and hours too, but within their rules, and they often collect the payment first and pay
            you out afterwards. Neither approach is wrong. Just know which one you are agreeing to.
          </p>
          <p>
            Walk-ins and phone bookings matter at most venues. On MySlot.LK, a front-desk walk-in is booked in seconds
            without the player needing an account, and one-tap QR check-ins get regulars on court quickly. Whatever
            you choose, make sure bookings that happen at your desk are handled too, so your calendar is always right.
          </p>

          <h2 className="pt-6 font-display text-2xl font-extrabold tracking-tight text-ink">How to get players to your own site</h2>
          <p>
            The worry we hear most is "who will find my website?" It is a fair question, and the answer is a short
            list of habits rather than advertising spend:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong className="text-ink">Put a QR code at the venue.</strong> Everyone standing at your front desk
              or leaving a session is a person who can book their next slot in ten seconds.
            </li>
            <li>
              <strong className="text-ink">Make the link your booking link everywhere.</strong> Your Facebook and
              Instagram bio, your WhatsApp status and group descriptions, and your Google Business Profile should all
              point to the same page instead of "call us to book".
            </li>
            <li>
              <strong className="text-ink">Claim your Google Business Profile.</strong> A verified listing with
              correct hours, photos and your website link is how most people nearby find a court, and it is free.
            </li>
            <li>
              <strong className="text-ink">Use offers for quiet hours.</strong> A discount on weekday afternoons gives
              regulars a reason to book on your site and fills hours that would otherwise sit empty.
            </li>
            <li>
              <strong className="text-ink">Ask regulars to book there.</strong> Teams and coaches who book every week
              are your best source of repeat business, and they only need to hear it once.
            </li>
          </ul>
          <p>
            None of this replaces the instant audience a marketplace has. It does mean every customer you bring in
            stays yours and books with you directly the next time.
          </p>

          <h2 className="pt-6 font-display text-2xl font-extrabold tracking-tight text-ink">When each makes sense</h2>
          <p>
            <strong className="text-ink">A marketplace is the better first step</strong> if you are brand new, have no
            regular customers, and need people to find you quickly, and you are comfortable with the platform owning the
            customer relationship.
          </p>
          <p>
            <strong className="text-ink">Your own website is the better foundation</strong> if you already have a
            local crowd, want to keep your customers and your margin, care about your brand, or are tired of
            double-bookings from phone, WhatsApp and a paper diary.
          </p>
          <p>
            <strong className="text-ink">Using both is fine.</strong> Many venues stay on a marketplace for discovery
            while sending their regulars to their own site. If you do that, point your social pages and QR codes at
            your own website, so the customers you win are the ones you keep.
          </p>
        </div>

        <h2 className="mt-12 font-display text-2xl font-extrabold tracking-tight text-ink">Seven questions to ask any platform</h2>
        <p className="mt-2 text-base text-ink-2">Ask these before you sign with anyone, us included:</p>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-base leading-relaxed text-ink-2">
          {CHECKLIST.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>

        <section className="mt-14 rounded-3xl border border-primary bg-primary-light p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">See it for your venue</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-2">
            Book a demo and we will set up your listing and website and apply your free first 3 months. See{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">pricing</Link> for the full plan.
          </p>
          <Link href="/#inquire" className={`${buttonVariants({ variant: "primary", size: "lg" })} mt-5`}>
            Book a demo with us
          </Link>
          <p className="mt-4 text-sm text-ink-2">
            Or reach us at{" "}
            <a href={`mailto:${contact.email}`} className="font-medium text-primary hover:underline">{contact.email}</a>
          </p>
        </section>
      </article>
    </main>
  );
}

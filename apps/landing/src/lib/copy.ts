/** Where the live product lives. Points at the player app when deployed. */
export function playerAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLAYER_APP_URL || "http://localhost:3000";
}

export interface Feature {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  bullets: string[];
  cta?: { label: string; href: string };
}

/** Public contact details for the platform. */
export const contact = {
  address: "69 Kongtree Road, Thalapitiya, Galle",
  phone: "+94 77 171 3701",
  phoneHref: "+94771713701",
  email: "info@myslot.lk"
};

/**
 * All landing-page copy. DRAFT lines are flagged for client tuning — the
 * structure ships as-is; wording is easy to change here.
 */
export const copy = {
  hero: {
    // DRAFT: the headline rotates through these short phrases
    headline: "Booked-out",
    headlineLead: "Book digitally,",
    usps: ["Booked-out", "Real-time", "Own website", "QR check-ins"],
    body: "Give your sports facility a dedicated website of its own — real-time slot booking, one-tap QR check-ins, and a console that shows you your whole day. List your venue free for 3 months.",
    primaryCta: "Book a demo with us",
    secondaryCta: "See how it works",
    scrollCue: "See how it works",
    // DRAFT: fine print under the CTAs
    finePrint: "3-month free trial for listed venues. No setup fees, no lock-in."
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "Live in three steps",
    steps: [
      {
        title: "Tell us about your venue",
        body: "Fill in the short form — name, email, venue details. No contracts, no fees."
      },
      {
        title: "We set you up",
        body: "Our team builds your venue listing and your dedicated website, adds your courts and slots, and applies your 3-month free plan."
      },
      {
        title: "Start taking bookings",
        body: "Go live. Players book in seconds on your own website, walk-ins check in at your front desk, and your whole day shows up in your console."
      }
    ]
  },
  features: {
    eyebrow: "Features",
    title: "Everything your venue needs",
    subtitle: "One platform for the bookings, check-ins, and venue management that keep your venue full.",
    items: [
      {
        id: "dedicated-site",
        eyebrow: "Own website",
        heading: "Your venue, on its own dedicated website",
        body: "We set up a dedicated website for your venue under your brand, on your own domain. Players browse, book, and check in on your site — not someone else's marketplace.",
        bullets: [
          "Your brand and colours, on your own domain",
          "Live bookings and check-ins run on your website",
          "Built for phones, because that's where players are"
        ]
      },
      {
        id: "real-time-bookings",
        eyebrow: "Real-time availability",
        heading: "Your courts, bookable in real time",
        body: "Players see your live slot availability and book in seconds — no phone tag, no paper book, no double-booked courts.",
        bullets: [
          "Courts, turf, and nets each get their own slot grid",
          "Players book instantly with a QR confirmation",
          "Your day fills itself — bookings land in your console"
        ]
      },
      {
        id: "front-desk",
        eyebrow: "Front desk",
        heading: "Front-desk & walk-in check-ins",
        body: "A one-tap QR check-in gets players on court fast, and walk-in guests book straight at your front desk without an account.",
        bullets: [
          "Players scan their booking QR at the venue",
          "Walk-in guests quick-book on your POS in seconds",
          "No-shows are easy to spot and re-fill"
        ]
      },
      {
        id: "owner-dashboard",
        eyebrow: "Your console",
        heading: "Know what's happening",
        body: "Your owner console is the single view of your venue's day — what's booked, what's checked in, what's been paid.",
        bullets: [
          "Live bookings and check-ins in one place",
          "Automated reminders go out so players actually show up",
          "Reports you can pull for planning and tax"
        ]
      }
    ]
  },
  capabilities: {
    eyebrow: "What you get",
    title: "Everything that comes with your venue",
    sub: "A clear list of what's included when you list with MySlot — no mystery, no hidden extras.",
    items: [
      {
        term: "Your own dedicated website",
        desc: "A branded booking website for your venue, on your own domain — live slots, check-ins, and your console all in one place."
      },
      {
        term: "Embeddable booking widget",
        desc: "Put the same booking engine on any page of your existing website with one line of embed code."
      },
      {
        term: "Multiple courts",
        desc: "Courts, turf, and nets each get their own bookable slot grid — manage them all from one console."
      },
      {
        term: "Cancellation cutoff",
        desc: "Set how long before a slot players can cancel themselves; past that, it's handled with your team."
      },
      {
        term: "Transparent tax",
        desc: "Tax-inclusive prices with the split shown clearly, so you always know what you keep."
      },
      {
        term: "Offers & discounts",
        desc: "Venue-wide or per-court offers you control — great for filling quiet hours."
      },
      {
        term: "Flexible opening windows",
        desc: "Open, close, and mid-day closures that match your real hours, day by day."
      },
      {
        term: "Variable pricing",
        desc: "Peak and off-peak prices per court and time — earn more when demand is high."
      },
      {
        term: "Reports",
        desc: "Bookings, check-ins, and revenue reports you can pull any time for planning and tax."
      },
      {
        term: "A clear plan & agreement",
        desc: "A simple monthly plan with a booking allowance, and a written agreement with MySlot — no surprises."
      }
    ]
  },
  trialBand: {
    title: "List your venue free for 3 months",
    sub: "No setup fees. No lock-in. We're building a player network — be one of the first venues on it."
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered",
    sub: "The things venue owners ask us most.",
    items: [
      {
        q: "How much does it cost to get started?",
        a: "Nothing. Every venue gets a 3-month free plan — no setup fees, no lock-in. After the trial you'll move to a simple monthly plan with a booking allowance."
      },
      {
        q: "Do I really get my own dedicated website?",
        a: "Yes. We build a dedicated website for your venue under your brand and your own domain, with live bookings and check-ins running on it. No technical work needed from you."
      },
      {
        q: "How long until my venue is live?",
        a: "Most venues go live within a few days. You share a few details about your venue, we set up your listing and your website, and you start taking bookings."
      },
      {
        q: "How do players book?",
        a: "They visit your website, pick a court and a slot from your live availability, and book in seconds — with an instant QR confirmation for the front desk."
      },
      {
        q: "What about walk-ins?",
        a: "Walk-ins are booked straight at your front desk on your console in seconds — no player account needed."
      },
      {
        q: "What if a player doesn't show up?",
        a: "No-shows are easy to spot in your console, and automated reminders go out before every slot so players actually turn up."
      },
      {
        q: "Can players cancel or change a booking?",
        a: "Players can self-cancel up to a cutoff you control. Past that, bookings are handled with your team. Cancellations and refunds follow your venue's policy."
      }
    ]
  },
  inquire: {
    eyebrow: "Ready when you are",
    title: "List your venue",
    body: "Tell us about your venue and we'll reach out to book your demo, set up your listing and your dedicated website, and apply your 3-month free plan. Or reach us directly:",
    fields: {
      name: "Name",
      namePlaceholder: "Your full name",
      email: "Email",
      emailPlaceholder: "you@example.com",
      phone: "Phone",
      phonePlaceholder: "07X XXX XXXX",
      venueName: "Venue name",
      venueNamePlaceholder: "e.g. Smash Arena",
      city: "City",
      cityPlaceholder: "e.g. Galle",
      message: "Message",
      messagePlaceholder: "Anything we should know?"
    },
    submit: "Book a demo",
    submitting: "Submitting…",
    successTitle: "Thank you — we'll be in touch",
    successBody: "Your details are with our team. We'll reach out shortly to book your demo, set up your listing and website, and apply your free plan.",
    errorGeneric: "Something went wrong submitting your details. Please try again."
  },
  footer: {
    tagline: "Book courts, join games, find your game.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "How it works", href: "#how-it-works" },
          { label: "List your venue", href: "#inquire" }
        ]
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Terms & Conditions", href: "/terms" },
          { label: "FAQ", href: "/faq" }
        ]
      }
    ]
  },
  legal: {
    contactHeading: "Contact",
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: August 2026",
      paragraphs: [
        "At MySlot.LK we take your privacy seriously. This policy explains what information we collect when you visit our website or get in touch, why we collect it, and how we use it.",
        "The information you provide — such as your name, email address, phone number, and venue details when you submit our enquiry form — is used only to respond to your enquiry, set up your venue listing, and operate your bookings.",
        "We do not sell your personal data. We share it only with the services we use to run the platform — such as payment, SMS, and email providers — and only to the extent needed to provide our service to you.",
        "Your data is stored securely and is kept only for as long as needed to operate your account and to meet our legal obligations.",
        "If you have questions about this policy, please contact us using the details below."
      ]
    },
    terms: {
      title: "Terms & Conditions",
      lastUpdated: "Last updated: August 2026",
      paragraphs: [
        "By using this website and booking through it, you agree to these terms.",
        "Bookings are subject to availability and to the venue's own rules, cancellation policy, and timings. Court prices, availability, and hours shown on a venue's site come directly from the venue and may change at any time.",
        "Payments, cancellations, and refunds follow the venue's policies, as shown at checkout.",
        "MySlot provides the booking technology behind a venue's dedicated website. The platform is not a party to the booking between a player and a venue, and disputes about a booking are between the player and the venue.",
        "If you have questions about these terms, please contact us using the details below."
      ]
    }
  }
};
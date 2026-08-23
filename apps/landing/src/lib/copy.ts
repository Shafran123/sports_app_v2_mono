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

/**
 * All landing-page copy. DRAFT lines are flagged for client tuning — the
 * structure ships as-is; wording is easy to change here.
 */
export const copy = {
  nav: {
    features: "Features",
    howItWorks: "How it works",
    players: "For players",
    mobileCta: "Book a demo",
    cta: "List your venue"
  },
  hero: {
    // DRAFT
    headline: "Booked-out courts, handled for you.",
    headlinePrefix: "Booked-out courts,",
    // DRAFT: rotate the headline value prop like ClassPass
    headlineRotations: [
      "handled for you.",
      "ready for your players.",
      "filling themselves up.",
      "payments handled too."
    ],
    body: "MySlot.LK puts your venue on a live booking platform — real-time slots, instant bookings, and payments your way. List your venue free for 3 months.",
    primaryCta: "Book a demo with us",
    secondaryCta: "See how it works",
    scrollCue: "See how it works",
    // DRAFT: one-word USPs that rotate in the hero
    usps: ["Real-time", "Effortless", "Cashless", "Profitable", "Booked-out"]
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
        body: "Our team builds your venue listing, adds your courts and slots, and applies your 3-month free plan."
      },
      {
        title: "Start taking bookings",
        body: "Go live. Players book in seconds, walk-ins check in at your front desk, and payments land in your reports."
      }
    ]
  },
  features: {
    eyebrow: "Features",
    title: "Everything your venue needs",
    subtitle: "One platform for the bookings, check-ins, payments, and events that keep your venue full.",
    items: [
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
id: "payments",
        eyebrow: "Payments",
        heading: "Payments your way",
        body: "Take payment online or in cash at the venue, and the tax split is handled transparently. Every booking billed for both of you.",
        bullets: [
          "Online payment via PayHere at checkout, or cash on the venue",
          "Prices are tax-inclusive — you see what you keep",
          "A PDF bill lands for every booking and event registration"
        ]
      },
      {
        id: "events",
        eyebrow: "Events",
        heading: "Events & registrations",
        body: "One-off tournaments, leagues, and clinics sell registrations just like tickets — a new revenue line from your existing space.",
        bullets: [
          "Set date, capacity, and price in minutes",
          "Players register and pay online in a couple of taps",
          "Great for leagues, clinics, and holiday camps"
        ]
      },
      {
        id: "owner-dashboard",
        eyebrow: "Your console",
        heading: "Know what's happening",
        body: "Your owner console is the single view of your venue's day — what's booked, what's checked in, what's been paid.",
        bullets: [
          "Live bookings, check-ins, and payments in one place",
          "Automated reminders go out so players actually show up",
          "Reports you can pull for planning and tax"
        ]
      }
    ]
  },
  playerFeatures: {
    eyebrow: "For players",
    title: "Find your game",
    items: [
      {
        id: "player-venue-detail",
        eyebrow: "For players",
        heading: "Pick a court, pick a slot",
        body: "Players see your live availability and choose exactly the court and time that works for them — no calls, no back-and-forth.",
        bullets: [
          "Live slot availability per court, updated in real time",
          "Prices and taxes shown up front, nothing hidden",
          "Book in seconds from the venue page"
        ],
        cta: { label: "Explore the player app", href: playerAppUrl() }
      },
      {
        id: "player-confirmation",
        eyebrow: "For players",
        heading: "Your booking, QR-ready",
        body: "Confirmation lands instantly with a QR code for the front desk — and a bill is emailed the moment payment clears.",
        bullets: [
          "Booking QR ready for a one-tap check-in",
          "PDF bill emailed on payment",
          "Reminders before the slot so nobody misses out"
        ]
      }
    ]
  },
  trialBand: {
    title: "List your venue free for 3 months",
    sub: "No setup fees. No lock-in. We're building a player network — be one of the first venues on it."
  },
  inquire: {
    eyebrow: "Ready when you are",
    title: "List your venue",
    body: "Tell us about your venue and we'll reach out to book your demo, set up your listing, and apply your 3-month free plan.",
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
      cityPlaceholder: "e.g. Colombo",
      message: "Message",
      messagePlaceholder: "Anything we should know?"
    },
    submit: "Book a demo",
    submitting: "Submitting…",
    successTitle: "Thank you — we'll be in touch",
    successBody: "Your details are with our team. We'll reach out shortly to book your demo, set up your listing, and apply your free plan.",
    errorGeneric: "Something went wrong submitting your details. Please try again."
  },
  footer: {
    tagline: "Book courts, join games, find your game.",
    contactEmail: "info@myslot.lk",
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
        title: "Company",
        links: [{ label: "Contact", mailto: "info@myslot.lk" }]
      }
    ]
  }
};
"use client";

import Link from "next/link";
import { CalendarX2 } from "lucide-react";

// Marketplace retirement (ADR-0045): the platform-wide browse/search/venue
// marketplace no longer sells to customers — venues sell on their own
// Dedicated Sites and Booking Widgets. Every marketplace route renders this
// slate instead of its old content. The branded venue page ([slug]), the
// widget embed, and site-hosted surfaces are untouched.
export function MarketplaceClosed() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <CalendarX2 className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
        Booking is moving to venue sites
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        Venues on this platform now sell directly on their own websites and booking widgets. To book
        a court, visit the venue&apos;s site — or use the booking link the venue sent you.
      </p>
      <p className="mt-4 text-sm text-ink-2">
        Existing bookings stay valid — your confirmation and check-in QR were sent by email and SMS.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 font-semibold text-surface transition-colors hover:bg-primary-hover"
      >
        Go to the platform home
      </Link>
    </main>
  );
}
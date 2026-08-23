"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BrandLockup } from "@myslot/ui";
import { featureFlags } from "@myslot/api";
import { DEFAULT_BRAND_NAME } from "@myslot/utils";

export function Footer() {
  const { data: flags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlags.get()
  });
  const brand = flags?.brand_name ?? DEFAULT_BRAND_NAME;

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight text-ink">
            <BrandLockup brand={brand} />
          </p>
          <p className="mt-1 text-sm text-ink-2">Book courts, join games, find your game.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-5 text-sm text-ink-2">
          <Link href="/explore" className="transition-colors hover:text-ink">Discover</Link>
          <Link href="/events" className="transition-colors hover:text-ink">Events</Link>
          <Link href="/bookings" className="transition-colors hover:text-ink">Bookings</Link>
        </nav>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} {brand}
      </p>
    </footer>
  );
}
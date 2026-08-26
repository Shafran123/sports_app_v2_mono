"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SiteConfig } from "@myslot/types";
import { Dialog, DialogContent } from "@myslot/ui";
import { Map } from "lucide-react";
import { brandCssVars } from "@/features/widget/widget-theme";
import { VenueStep } from "@/features/widget/venue-step";
import { SiteAccountPanel } from "./site-account-panel";

// The white-labeled chrome of a Dedicated Site (ADR-0029): Business brand
// header + attribution footer around the app's venue pages and booking flow.
// Rendered by the (shell) layout when the current hostname is a live Site
// Hostname — the marketplace chrome (PlayerNav/Footer/BottomTabs) is replaced,
// not appended to.
//
// Brand-color mapping (ADR-0031): the app's booking flow styles itself with
// the design tokens (--color-primary etc.). On a site host those tokens are
// overridden with the Business's brand colors, so the venue detail page,
// checkout and success screens — everything under the site host — render in
// the Business's look with no per-page edits. The marketplace host keeps the
// platform defaults.
//
// ADR-0032: the page background is always neutral (no brand tint), the header
// stays slim (logo + name + account), and venue switching lives in a dialog
// reachable only from venue pages — never the home page.

const BRAND_TOKEN_FALLBACKS = {
  "--color-primary": "#16a34a",
  "--color-accent": "#2563eb"
} as const;

export function SiteChrome({ config, children }: { config: SiteConfig; children: ReactNode }) {
  const { business, venues } = config;
  const style = {
    ...brandCssVars(business.brand),
    ...brandTokenOverrides(business.brand?.colors)
  };
  const multi = venues.length > 1;
  const pathname = usePathname();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Mark this surface as owner-hosted so the API client sends the Site
  // Customer session (own auth, ADR-0030) and the auth context stops watching
  // Firebase.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__SITE_HOST__ = true;
    }
  }, []);

  // Venue switching is a detail-page affordance (ADR-0032): the portfolio
  // root has its own grid and the legal pages have none, so the header
  // chooser only appears on actual venue pages.
  const isVenuePage =
    venues.some((v) => v.slug && `/${v.slug}` === pathname) || /^\/venues\/[^/]+$/.test(pathname);
  const openVenue = (id: string) => {
    setPickerOpen(false);
    const venue = venues.find((v) => v.id === id);
    if (venue?.slug) router.push(`/${venue.slug}`);
  };

  return (
    <div style={style} className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-6 md:py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={business.name}>
            {business.brand?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.brand.logo_url} alt="" className="h-10 w-auto shrink-0 object-contain md:h-11" />
            ) : null}
            <p className="truncate font-display text-lg font-extrabold tracking-tight text-ink md:text-xl">
              {business.name}
            </p>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {multi && isVenuePage ? (
              <>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="hidden rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink sm:inline-flex"
                >
                  Switch venue
                </button>
                <button
                  type="button"
                  aria-label="Choose a venue"
                  onClick={() => setPickerOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-2 transition-colors hover:text-ink sm:hidden"
                >
                  <Map className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <SiteAccountPanel business={business} />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-surface/60 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-ink-3 md:px-6">
          <p className="font-semibold text-ink-2">{business.name}</p>
          {business.brand?.tagline ? <p className="mt-0.5">{business.brand.tagline}</p> : null}
          <p className="mt-2">
            Booking by{" "}
            <Link href="/" className="font-semibold text-primary underline-offset-2 hover:underline">
              MySlot.LK
            </Link>
          </p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link href="/privacy" className="font-medium text-ink-2 underline-offset-2 transition-colors hover:text-ink">
              Privacy Policy
            </Link>
            <Link href="/terms" className="font-medium text-ink-2 underline-offset-2 transition-colors hover:text-ink">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </footer>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent title="Choose a venue" className="max-w-md">
          <p className="mb-3 text-sm text-ink-2">Pick a venue to book. You can switch anytime.</p>
          <VenueStep venues={venues} selectedId={null} onSelect={openVenue} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Map the Business's brand colors onto the app's design-token variables for
// the whole site subtree. Hover/light variants are derived as CSS color-mix
// values so they stay in the same hue as the chosen primary (ADR-0031). The
// page background stays neutral per ADR-0032 — the tint wash was removed.
function brandTokenOverrides(colors: { primary?: string; accent?: string } | undefined): Record<string, string> {
  const primary = colors?.primary || BRAND_TOKEN_FALLBACKS["--color-primary"];
  const accent = colors?.accent || BRAND_TOKEN_FALLBACKS["--color-accent"];
  return {
    "--color-primary": primary,
    "--color-primary-hover": `color-mix(in srgb, ${primary} 85%, black)`,
    "--color-primary-light": `color-mix(in srgb, ${primary} 12%, white)`,
    "--color-accent": accent,
    "--color-accent-light": `color-mix(in srgb, ${accent} 12%, white)`
  };
}
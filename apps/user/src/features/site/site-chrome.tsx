"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import type { SiteConfig } from "@myslot/types";
import { brandCssVars } from "@/features/widget/widget-theme";
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

  // Mark this surface as owner-hosted so the API client sends the Site
  // Customer session (own auth, ADR-0030) and the auth context stops watching
  // Firebase.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__SITE_HOST__ = true;
    }
  }, []);

  return (
    <div style={style} className="flex min-h-screen flex-col bg-[var(--brand-bg,#fafaf7)] text-ink">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          {business.brand?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.brand.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
          ) : null}
          <Link href="/" className="min-w-0">
            <p className="truncate font-display text-lg font-extrabold tracking-tight text-ink">
              {business.name}
            </p>
            {business.brand?.tagline ? (
              <p className="truncate text-xs font-medium" style={{ color: "var(--brand-primary, #16a34a)" }}>
                {business.brand.tagline}
              </p>
            ) : null}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {multi ? (
              <Link
                href="/?pick=1"
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
              >
                Switch venue
              </Link>
            ) : null}
            <SiteAccountPanel business={business} />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-surface/60 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-ink-3 md:px-6">
          <p className="font-semibold text-ink-2">{business.name}</p>
          {business.brand?.tagline ? <p className="mt-0.5">{business.brand.tagline}</p> : null}
          <p className="mt-2">
            Booking by{" "}
            <Link href="/" className="font-semibold text-primary underline-offset-2 hover:underline">
              MySlot.LK
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

// Map the Business's brand colors onto the app's design-token variables for
// the whole site subtree. Hover/light variants are derived as CSS color-mix
// values so they stay in the same hue as the chosen primary; the site's page
// background resolves to a subtle tint of the brand so no hardcoded fallback
// is left (ADR-0031).
function brandTokenOverrides(colors: { primary?: string; accent?: string } | undefined): Record<string, string> {
  const primary = colors?.primary || BRAND_TOKEN_FALLBACKS["--color-primary"];
  const accent = colors?.accent || BRAND_TOKEN_FALLBACKS["--color-accent"];
  return {
    "--color-primary": primary,
    "--color-primary-hover": `color-mix(in srgb, ${primary} 85%, black)`,
    "--color-primary-light": `color-mix(in srgb, ${primary} 12%, white)`,
    "--color-accent": accent,
    "--color-accent-light": `color-mix(in srgb, ${accent} 12%, white)`,
    "--brand-bg": `color-mix(in srgb, ${primary} 5%, #fafaf7)`
  };
}
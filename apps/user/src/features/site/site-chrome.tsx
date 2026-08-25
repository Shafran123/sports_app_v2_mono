import type { ReactNode } from "react";
import Link from "next/link";
import type { SiteConfig } from "@myslot/types";
import { brandCssVars } from "@/features/widget/widget-theme";

// The white-labeled chrome of a Dedicated Site (ADR-0029): Business brand
// header + attribution footer around the app's venue pages and booking flow.
// Rendered by the (shell) layout when the current hostname is a live Site
// Hostname — the marketplace chrome (PlayerNav/Footer/BottomTabs) is replaced,
// not appended to.

export function SiteChrome({ config, children }: { config: SiteConfig; children: ReactNode }) {
  const { business, venues } = config;
  const style = brandCssVars(business.brand);
  const multi = venues.length > 1;

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
          <div className="ml-auto">
            {multi ? (
              <Link
                href="/?pick=1"
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
              >
                Switch venue
              </Link>
            ) : null}
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
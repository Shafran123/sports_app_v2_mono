"use client";

// The Dedicated Site portfolio root (ADR-0029): Business hero + venue cards
// under the site's brand chrome. A "pick a venue" popup opens on first visit
// when the Business has 2+ approved venues, and reopens via /?pick=1 (the
// persistent "Switch venue" control in the site header).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import type { SiteConfig } from "@myslot/types";
import { Badge, Dialog, DialogContent } from "@myslot/ui";
import { brandCssVars } from "@/features/widget/widget-theme";
import { VenueStep } from "@/features/widget/venue-step";

export function SiteHome({ config }: { config: SiteConfig }) {
  const { business, venues } = config;
  const style = useMemo(() => brandCssVars(business.brand), [business.brand]);
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  // First-visit popup: shown once per hostname per browser; /?pick=1 always
  // reopens it (the header's "Switch venue" control).
  useEffect(() => {
    if (venues.length <= 1) return;
    const dismissKey = `site-picker-dismissed-${window.location.hostname}`;
    const forced = window.location.search.includes("pick=1");
    if (forced) {
      setPickerOpen(true);
      return;
    }
    if (!localStorage.getItem(dismissKey)) setPickerOpen(true);
  }, [venues.length]);

  const cover = business.brand?.logo_url || venues[0]?.photos?.[0];
  const openVenue = (id: string) => {
    setPickerOpen(false);
    const venue = venues.find((v) => v.id === id);
    if (venue?.slug) router.push(`/${venue.slug}`);
  };

  return (
    <div style={style} className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
      {cover ? (
        <div className="relative mt-6 h-64 w-full overflow-hidden rounded-3xl md:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
              {business.name}
            </h1>
            {business.brand?.tagline && (
              <p className="mt-1 text-sm font-semibold text-white/90 md:text-base">{business.brand.tagline}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-10 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-5xl">
            {business.name}
          </h1>
          {business.brand?.tagline && (
            <p className="mt-1 font-medium" style={{ color: "var(--brand-primary, #16a34a)" }}>
              {business.brand.tagline}
            </p>
          )}
        </div>
      )}

      {business.brand?.about && (
        <p className="mx-auto mt-8 max-w-2xl whitespace-pre-line text-center text-sm leading-relaxed text-ink-2">
          {business.brand.about}
        </p>
      )}

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
          Our venues
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={venue.slug ? `/${venue.slug}` : `/venues/${venue.id}`}
              className="press-raise group block overflow-hidden rounded-3xl border border-border bg-surface shadow-soft"
            >
              {venue.photos?.[0] ? (
                <div className="relative h-40 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={venue.photos[0]}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="h-40 w-full bg-surface-2" />
              )}
              <div className="p-4">
                <h3 className="truncate font-semibold tracking-tight text-ink">{venue.name}</h3>
                {venue.address || venue.city ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {[venue.address, venue.city].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                {venue.sports?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {venue.sports.slice(0, 3).map((sport) => (
                      <Badge key={sport} variant="neutral">{sport}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Dialog open={pickerOpen} onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open) localStorage.setItem(`site-picker-dismissed-${window.location.hostname}`, "1");
      }}>
        <DialogContent title="Choose a venue" className="max-w-md">
          <p className="mb-3 text-sm text-ink-2">Pick a venue to book. You can switch anytime.</p>
          <VenueStep venues={venues} selectedId={null} onSelect={openVenue} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
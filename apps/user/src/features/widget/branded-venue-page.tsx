"use client";

// The white-labeled storefront (ADR-0028, ticket 06): Business brand chrome
// (colors, tagline, logo) over the venue's own content — name, photos,
// about + hours + contact — and the booking flow inline. One page per venue —
// portfolio pages are v2 (ADR-0028 v1.5: brand tokens moved from the venue
// to its Business). Prices always come from the court config, never re-entered.

import { useMemo } from "react";
import { MapPin, Phone, Clock } from "lucide-react";
import { Badge } from "@myslot/ui";
import type { WidgetConfig } from "@myslot/types";
import { BookPanel } from "./book-panel";
import { brandCssVars } from "./widget-theme";
import { SiteCarousel } from "@/features/site/site-carousel";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function BrandedVenuePage({ venue }: { venue: WidgetConfig }) {
  const brand = venue.business?.brand;
  const style = useMemo(() => brandCssVars(brand), [brand]);
  const photos = venue.photos?.length
    ? venue.photos.map((src) => ({ src, caption: undefined }))
    : [];

  return (
    <div style={style} className="min-h-screen bg-paper">
      {photos.length > 0 && <SiteCarousel slides={photos} alt={venue.name} className="h-60 w-full md:h-96" />}

      <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        <div className="relative z-10 mt-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-lift">
            <div className="p-6 md:p-8" style={{ borderTop: `6px solid var(--brand-primary, #16a34a)` }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  {venue.business?.brand?.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={venue.business.brand.logo_url}
                      alt={`${venue.business.name} logo`}
                      className="mb-2 h-12 w-12 rounded-2xl border border-border object-cover"
                    />
                  )}
                  {venue.business?.name && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                      {venue.business.name}
                    </p>
                  )}
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-4xl">
                    {venue.name}
                  </h1>
                  {brand?.tagline && (
                    <p className="mt-1 font-medium" style={{ color: "var(--brand-primary, #16a34a)" }}>
                      {brand.tagline}
                    </p>
                  )}
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                    {venue.address || venue.city ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {[venue.address, venue.city].filter(Boolean).join(", ")}
                      </span>
                    ) : null}
                    {venue.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> {venue.phone}
                      </span>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {venue.sports?.map((sport) => (
                      <Badge key={sport} variant="neutral">{sport}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-ink-2 md:text-right">
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <Clock className="h-4 w-4" /> Opening hours
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {DAY_NAMES.map((day, i) => {
                      const window = venue.hours?.find((h) => h.day_of_week === i);
                      return (
                        <li key={day} className="text-xs">
                          {day}: {window ? `${window.open_time} – ${window.close_time}` : "Closed"}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {brand?.about && (
                <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink-2">
                  {brand.about}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          {/* The branded page is per-venue: never a venue step, never an
              instance key at checkout (the page IS the venue). */}
          <BookPanel venue={venue} />
        </div>
      </div>
    </div>
  );
}
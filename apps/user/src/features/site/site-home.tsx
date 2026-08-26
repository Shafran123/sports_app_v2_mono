"use client";

// The Dedicated Site portfolio root (ADR-0029 + ADR-0031): Business hero
// (hero image / headline / CTA), about, the auto-generated venues grid (each
// card carries an auto Google-Maps link from its coordinates), and the
// contact strip. A "pick a venue" popup opens on first visit when the
// Business has 2+ approved venues, and reopens via /?pick=1 (the persistent
// "Switch venue" control in the site header).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { SiteConfig, SiteVenue } from "@myslot/types";
import { Badge, Button, Dialog, DialogContent } from "@myslot/ui";
import { formatLkr } from "@myslot/utils";
import { brandCssVars } from "@/features/widget/widget-theme";
import { VenueStep } from "@/features/widget/venue-step";

const SITE_CONTACT_ROWS = [
  { key: "phone", icon: Phone },
  { key: "email", icon: Mail },
  { key: "address", icon: MapPin },
  { key: "hours", icon: Clock }
] as const;

function mapsUrl(venue: SiteVenue): string | null {
  if (venue.lat != null && venue.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  }
  return null;
}

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

  const brand = business.brand;
  const cover = brand?.hero_image || brand?.logo_url || venues[0]?.photos?.[0];
  const contact = brand?.contact;
  const hasContact = contact && SITE_CONTACT_ROWS.some(({ key }) => Boolean(contact?.[key]));
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
          <img src={cover} alt={business.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
              {business.name}
            </h1>
            {brand?.headline && (
              <p className="mt-1 text-sm font-semibold text-white/90 md:text-base">{brand.headline}</p>
            )}
            {brand?.tagline && (
              <p className="mt-0.5 text-xs font-medium text-white/70 md:text-sm">{brand.tagline}</p>
            )}
            <Button
              className="mt-4"
              onClick={() => document.getElementById("venues")?.scrollIntoView({ behavior: "smooth" })}
            >
              Book now
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-10 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-5xl">
            {business.name}
          </h1>
          {brand?.headline && (
            <p className="mt-1 font-medium" style={{ color: "var(--brand-primary, #16a34a)" }}>
              {brand.headline}
            </p>
          )}
          {brand?.tagline && <p className="mt-0.5 text-sm text-ink-2">{brand.tagline}</p>}
          <Button className="mt-5" onClick={() => document.getElementById("venues")?.scrollIntoView({ behavior: "smooth" })}>
            Book now
          </Button>
        </div>
      )}

      {brand?.about && (
        <p className="mx-auto mt-8 max-w-2xl whitespace-pre-line text-center text-sm leading-relaxed text-ink-2">
          {brand.about}
        </p>
      )}

      <section id="venues" className="mt-12 scroll-mt-24">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
          Our venues
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      </section>

      {hasContact && (
        <section className="mt-12 rounded-3xl border border-border bg-surface p-6 shadow-soft md:p-8">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
            Find us
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {SITE_CONTACT_ROWS.filter(({ key }) => contact?.[key]).map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-2.5 text-sm text-ink-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                  <Icon className="h-4 w-4" />
                </span>
                {key === "email" && contact?.email ? (
                  <a href={`mailto:${contact.email}`} className="font-medium text-ink transition-colors hover:text-primary">
                    {contact.email}
                  </a>
                ) : (
                  <span className="whitespace-pre-line">{contact?.[key]}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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

function VenueCard({ venue }: { venue: SiteVenue }) {
  const href = venue.slug ? `/${venue.slug}` : `/venues/${venue.id}`;
  const directions = mapsUrl(venue);
  return (
    <article className="press-raise group relative block overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
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
      {directions && (
        <a
          href={directions}
          target="_blank"
          rel="noreferrer"
          aria-label={`Directions to ${venue.name}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white shadow-soft backdrop-blur transition-colors hover:bg-primary"
        >
          <Navigation className="h-4 w-4" />
        </a>
      )}
      <Link href={href} className="absolute inset-0" aria-label={venue.name} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold tracking-tight text-ink">{venue.name}</h3>
          {venue.min_price != null && (
            <p className="shrink-0 text-xs font-semibold text-ink-2">
              from <span className="font-display text-sm font-extrabold text-ink">{formatLkr(venue.min_price)}</span>
            </p>
          )}
        </div>
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
    </article>
  );
}
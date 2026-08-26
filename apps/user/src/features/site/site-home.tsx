"use client";

// The Dedicated Site portfolio root (ADR-0029 + ADR-0031 + ADR-0032): a hero
// carousel driven by the owner's Site Gallery (with per-slide captions), an
// intro block (name / headline / tagline), about, the auto-generated venues
// grid (each card carries an auto Google-Maps link from its coordinates),
// the contact strip and the legal footer links.
//
// ADR-0032: no auto "pick a venue" popup and no /?pick=1 — venue switching
// lives in the header of detail pages only. With exactly one approved venue
// the home redirects straight to it.

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { SiteConfig, SiteVenue } from "@myslot/types";
import { Badge, Button } from "@myslot/ui";
import { formatLkr } from "@myslot/utils";
import { brandCssVars } from "@/features/widget/widget-theme";
import { SiteCarousel, type CarouselSlide } from "./site-carousel";

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

  // A single approved venue has nothing to browse: land on its page instead
  // of an empty portfolio root (ADR-0032).
  useEffect(() => {
    if (venues.length !== 1) return;
    const venue = venues[0]!;
    router.replace(venue.slug ? `/${venue.slug}` : `/venues/${venue.id}`);
  }, [venues, router]);

  const brand = business.brand;
  // Site Gallery drives the hero (1-6 slides, optional captions); sites
  // without one fall back to the legacy hero image, then logo, then the
  // first venue photo.
  const slides: CarouselSlide[] =
    brand?.gallery?.length && brand.gallery.some((s) => s.image_url)
      ? brand.gallery
          .filter((s) => s.image_url)
          .map((s) => ({ src: s.image_url, caption: s.caption || undefined }))
      : [
          {
            src: brand?.hero_image || brand?.logo_url || venues[0]?.photos?.[0] || "",
            caption: undefined
          }
        ].filter((s) => s.src);
  const contact = brand?.contact;
  const hasContact = contact && SITE_CONTACT_ROWS.some(({ key }) => Boolean(contact?.[key]));

  return (
    <div style={style} className="mx-auto pb-24">
      {slides.length > 0 ? (
        <SiteCarousel
          slides={slides}
          alt={business.name}
          className="h-72 w-full md:h-[28rem]"
        />
      ) : null}

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mt-10 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-5xl">
            {business.name}
          </h1>
          {brand?.headline && (
            <p className="mt-1 font-medium" style={{ color: "var(--brand-primary, #16a34a)" }}>
              {brand.headline}
            </p>
          )}
          {brand?.tagline && <p className="mt-0.5 text-sm text-ink-2 md:text-base">{brand.tagline}</p>}
          <Button className="mt-5" onClick={() => document.getElementById("venues")?.scrollIntoView({ behavior: "smooth" })}>
            Book now
          </Button>
        </div>

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
      </div>
    </div>
  );
}

function VenueCard({ venue }: { venue: SiteVenue }) {
  const href = venue.slug ? `/${venue.slug}` : `/venues/${venue.id}`;
  const directions = mapsUrl(venue);
  return (
    <article className="press-raise group relative block overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
      {venue.photos?.[0] ? (
        <div className="relative h-44 w-full overflow-hidden md:h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={venue.photos[0]}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-44 w-full bg-surface-2 md:h-48" />
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
      <div className="p-5">
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
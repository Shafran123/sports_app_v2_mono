"use client";

// The Dedicated Site home (ADR-0034 rev.): a top banner (the Business's Site
// Banner image, rendered in the same photo carousel as the venue pages) with
// the logo above the business name, a short description overlaid, and the
// social icons + a "Find us" dialog nested into the banner. Then the "Our
// venues" heading with minimal venue cards (Open Status pill, sports, maps
// link, price). On desktop the whole page sits in a centered, side-padded
// rectangle that fills one viewport; the venue region scrolls internally when
// the cards overflow, small screens scroll normally. With exactly one approved
// venue the home redirects straight to that venue's page.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { SiteConfig, SiteVenue, SocialLinks } from "@myslot/types";
import { Dialog, DialogContent } from "@myslot/ui";
import { formatLkr } from "@myslot/utils";
import { brandCssVars } from "@/features/widget/widget-theme";
import { SiteCarousel, type CarouselSlide } from "./site-carousel";
import { SiteAccountPanel } from "./site-account-panel";

const CLOSING_SOON_MINUTES = 60;

const CONTACT_ROWS = [
  { key: "phone", icon: Phone },
  { key: "email", icon: Mail },
  { key: "address", icon: MapPin },
  { key: "hours", icon: Clock }
] as const;

const SOCIAL_LINK_KEYS = ["facebook", "instagram", "tiktok", "whatsapp", "youtube"] as const;
type SocialPlatform = (typeof SOCIAL_LINK_KEYS)[number];

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  youtube: "YouTube"
};

function mapsUrl(venue: SiteVenue): string | null {
  if (venue.lat != null && venue.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  }
  return null;
}

function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

// The card's Open Status pill (ADR-0034 rev.): a live open/closed verdict
// against the visitor's device clock, with a "Closing soon" state when under
// an hour of the day's close remains.
export function openStatus(
  venue: SiteVenue,
  now = new Date()
): { tone: "open" | "closing" | "closed"; label: string } {
  const todayDow = now.getDay();
  const entries = (venue.hours ?? []).filter((h) => Number(h.day_of_week) === todayDow);
  if (entries.length === 0) return { tone: "closed", label: "Closed today" };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const e of entries) {
    const start = toMinutes(e.open_time);
    const end = toMinutes(e.close_time);
    if (nowMin >= start && nowMin < end) {
      return nowMin >= end - CLOSING_SOON_MINUTES
        ? { tone: "closing", label: "Closing soon" }
        : { tone: "open", label: "Open now" };
    }
  }
  return { tone: "closed", label: "Closed now" };
}

function VenueCard({ venue }: { venue: SiteVenue }) {
  const href = venue.slug ? `/${venue.slug}` : `/venues/${venue.id}`;
  const directions = mapsUrl(venue);
  const status = openStatus(venue);
  const location = [venue.address, venue.city].filter(Boolean).join(", ");
  const pillTone =
    status.tone === "open"
      ? "bg-success-light text-success"
      : status.tone === "closing"
        ? "bg-warning-light text-warning"
        : "bg-surface-2 text-ink-3";

  return (
    <article className="relative flex items-stretch justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lift">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="truncate font-semibold tracking-tight text-ink">{venue.name}</h3>
        {location ? <p className="text-sm text-ink-3">{location}</p> : null}
        {venue.sports?.length ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {venue.sports.slice(0, 5).map((sport) => (
              <span
                key={sport.name}
                title={sport.name}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-sm"
              >
                {sport.icon || "•"}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pillTone}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {status.label}
        </span>
        <div className="flex items-center gap-3">
          {venue.min_price != null && (
            <p className="text-right text-sm text-ink-3">
              from <span className="font-display text-base font-extrabold text-ink">{formatLkr(venue.min_price)}</span>
            </p>
          )}
          {directions ? (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              aria-label={`Directions to ${venue.name}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors hover:bg-primary hover:text-white"
            >
              <Navigation className="h-4 w-4" />
            </a>
          ) : null}
          <Link href={href} className="absolute inset-0" aria-label={venue.name} />
        </div>
      </div>
    </article>
  );
}

function hasSocialLinks(links: SocialLinks | undefined): boolean {
  return SOCIAL_LINK_KEYS.some((key) => Boolean(links?.[key]));
}

export function SiteHome({ config }: { config: SiteConfig }) {
  const { business, venues } = config;
  const style = useMemo(() => brandCssVars(business.brand), [business.brand]);
  const router = useRouter();
  const [findUsOpen, setFindUsOpen] = useState(false);

  // A single approved venue has nothing to browse: land on its page instead
  // of an empty portfolio root (ADR-0032).
  useEffect(() => {
    if (venues.length !== 1) return;
    const venue = venues[0]!;
    router.replace(venue.slug ? `/${venue.slug}` : `/venues/${venue.id}`);
  }, [venues, router]);

  const brand = business.brand;
  const description =
    brand?.about ||
    brand?.tagline ||
    `Book a court at ${business.name}`;
  const capped = description.length > 240 ? `${description.slice(0, 240).trimEnd()}…` : description;

  // The banner renders the Business's Site Banner through the venue-page
  // carousel component; without one, a brand panel stands in so the name,
  // description and account control are always present.
  const bannerSlides: CarouselSlide[] = brand?.banner_image
    ? [{ src: brand.banner_image, caption: undefined }]
    : [];
  const contact = brand?.contact;
  const hasContact = contact && CONTACT_ROWS.some(({ key }) => Boolean(contact?.[key]));
  const hasSocial = hasSocialLinks(brand?.social_links);

  const heroOverlay = (
    <div className="max-w-2xl">
      {brand?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo_url} alt="" className="mb-2 h-14 w-14 rounded-2xl border border-white/20 bg-white/10 object-cover p-1 backdrop-blur md:h-16 md:w-16" />
      ) : null}
      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)] md:text-5xl">
        {business.name}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] md:text-base">
        {capped}
      </p>
      {hasContact || hasSocial ? (
        <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2">
          {brand?.social_links &&
            SOCIAL_LINK_KEYS.map((key) => {
              const url = brand?.social_links?.[key];
              if (!url) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${business.name} on ${SOCIAL_LABELS[key]}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur transition-colors hover:bg-primary"
                >
                  <SocialIcon platform={key} className="h-4 w-4" />
                </a>
              );
            })}
          {hasContact ? (
            <button
              type="button"
              onClick={() => setFindUsOpen(true)}
              className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-primary"
            >
              Find us
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div style={style} className="flex min-h-0 flex-1 flex-col items-center">
      <div className="flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5 px-4 pb-8 pt-4 md:px-6 md:pt-6">
        <div className="relative shrink-0 overflow-hidden rounded-3xl shadow-lift">
          {bannerSlides.length > 0 ? (
            <SiteCarousel slides={bannerSlides} alt={business.name} overlay={heroOverlay} className="h-56 w-full md:h-72" />
          ) : (
            <div className="relative bg-ink">
              <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">{heroOverlay}</div>
            </div>
          )}
          <div className="absolute right-4 top-4 z-20">
            <SiteAccountPanel business={business} onDark />
          </div>
        </div>

<section id="venues" className="flex min-h-0 flex-1 flex-col">
          <h2 className="shrink-0 font-display text-lg font-extrabold tracking-tight text-ink">
            Our venues
          </h2>
          {venues.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">New venues coming soon.</p>
          ) : (
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pb-2 pr-1">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={findUsOpen} onOpenChange={setFindUsOpen}>
        <DialogContent title="Find us" description={business.name}>
          {contact ? (
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {CONTACT_ROWS.filter(({ key }) => contact?.[key]).map(({ key, icon: Icon }) => (
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
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true
  };
  switch (platform) {
    case "facebook":
      return (
        <svg {...common}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
  }
}
import type { VenueDetail } from "@myslot/types";
import { dayName, formatLkr } from "@myslot/utils";

type SeoVenue = Pick<
  VenueDetail,
  "name" | "description" | "address" | "city" | "phone" | "photos" | "sports" | "courts" | "hours" | "lat" | "lng" | "min_price" | "max_price" | "amenities"
>;

const titleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

/** City names arrive as typed by owners ("galle"); present them capitalised. */
export function prettyCity(city: string | null | undefined): string {
  return city ? titleCase(city.trim()) : "";
}

const hhmm = (time: string) => time.slice(0, 5);

/** One-sentence meta description from the venue's own data; business "about" is only a last resort. */
export function venueDescription(venue: SeoVenue, fallbackAbout?: string): string {
  const sports = venue.sports.map(titleCase).join(", ");
  const city = prettyCity(venue.city);
  const own = venue.description?.trim();
  if (own) return own.length > 160 ? `${own.slice(0, 157).trimEnd()}...` : own;
  const where = city ? ` in ${city}` : "";
  const what = sports ? `Book ${sports} courts` : "Book courts";
  const base = `${what} at ${venue.name}${where}. Real-time availability, instant confirmation.`;
  return base || fallbackAbout || "";
}

function absoluteUrl(url: string, origin: string): string {
  return /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** schema.org SportsActivityLocation for a venue; omits anything the venue does not have. */
export function venueJsonLd(venue: SeoVenue, opts: { origin: string; path: string; businessName?: string }) {
  const city = prettyCity(venue.city);
  const prices = [venue.min_price, venue.max_price].filter((p): p is number => typeof p === "number");
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: venue.name,
    url: `${opts.origin}${opts.path}`,
    description: venueDescription(venue),
    ...(venue.photos.length ? { image: venue.photos.slice(0, 5).map((p) => absoluteUrl(p, opts.origin)) } : {}),
    ...(venue.phone ? { telephone: venue.phone } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address,
      ...(city ? { addressLocality: city } : {}),
      addressCountry: "LK"
    },
    ...(venue.lat != null && venue.lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lng } }
      : {}),
    ...(venue.hours.length
      ? {
          openingHoursSpecification: venue.hours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: dayName(h.day_of_week),
            opens: hhmm(h.open_time),
            closes: hhmm(h.close_time)
          }))
        }
      : {}),
    ...(prices.length
      ? { priceRange: [...new Set(prices.map((p) => formatLkr(p)))].join(" - ") }
      : {}),
    ...(venue.amenities.length
      ? { amenityFeature: venue.amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })) }
      : {}),
    ...(opts.businessName ? { parentOrganization: { "@type": "Organization", name: opts.businessName } } : {})
  };
}

/** JSON for a <script type="application/ld+json">: "<" escaped so venue text cannot close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

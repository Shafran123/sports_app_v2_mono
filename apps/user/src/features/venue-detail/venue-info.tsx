"use client";

import {
  Bath,
  Car,
  Check,
  CupSoda,
  Lightbulb,
  Lock,
  MapPin,
  Navigation,
  Shirt,
  Star,
  UtensilsCrossed,
  Wifi,
  Wind,
  type LucideIcon
} from "lucide-react";
import { Badge, Card } from "@spots/ui";
import { cn, dayName, formatLkr, humanizeSlug } from "@spots/utils";
import type { VenueDetail } from "@spots/types";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function amenityIcon(amenity: string): LucideIcon {
  const s = amenity.toLowerCase();
  if (s.includes("park")) return Car;
  if (s.includes("wifi")) return Wifi;
  if (s.includes("air") || s === "ac") return Wind;
  if (s.includes("food") || s.includes("cafe") || s.includes("snack") || s.includes("restaurant")) return UtensilsCrossed;
  if (s.includes("shower") || s.includes("bath") || s.includes("washroom") || s.includes("toilet")) return Bath;
  if (s.includes("chang")) return Shirt;
  if (s.includes("locker")) return Lock;
  if (s.includes("light")) return Lightbulb;
  if (s.includes("drink") || s.includes("water") || s.includes("refreshment")) return CupSoda;
  return Check;
}

function clock12(time: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return time;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m[2]} ${suffix}`;
}

function mapsUrl(venue: VenueDetail): string {
  if (venue.lat != null && venue.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  }
  const location = [venue.address, venue.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function VenueInfo({ venue }: { venue: VenueDetail }) {
  const rating = (venue as VenueDetail & { rating?: number | null }).rating;
  const location = [venue.address, venue.city].filter(Boolean).join(", ");
  const todayDow = new Date().getDay();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              {venue.name}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {location}
            </p>
            <a
              href={mapsUrl(venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Get directions
            </a>
          </div>
          {venue.min_price != null && (
            <p className="text-sm text-ink-3">
              from <span className="font-display text-xl font-extrabold text-ink">{formatLkr(venue.min_price)}</span>
            </p>
          )}
        </div>

        {rating != null && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1 text-sm font-bold text-warning">
            <Star className="h-4 w-4 fill-current" aria-hidden="true" />
            {rating.toFixed(1)}
          </div>
        )}

        {venue.description && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-2">{venue.description}</p>
        )}
      </div>

      {(venue.sports.length > 0 || venue.amenities.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {venue.sports.map((sport) => (
            <Badge key={sport} variant="primary" className="px-3 py-1">
              {sport}
            </Badge>
          ))}
          {venue.amenities.map((amenity) => {
            const Icon = amenityIcon(amenity);
            return (
              <Badge key={amenity} variant="neutral" className="px-3 py-1">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {humanizeSlug(amenity)}
              </Badge>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {venue.rules && (
          <Card className="p-5">
            <h2 className="font-semibold tracking-tight text-ink">Venue rules</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{venue.rules}</p>
          </Card>
        )}
        {venue.cancellation_policy && (
          <Card className="p-5">
            <h2 className="font-semibold tracking-tight text-ink">Cancellation policy</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{venue.cancellation_policy}</p>
          </Card>
        )}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold tracking-tight text-ink">Opening hours</h2>
        <div className="mt-2 divide-y divide-border">
          {DAYS.map((dow) => {
            const entries = venue.hours.filter((h) => h.day_of_week === dow);
            const isToday = dow === todayDow;
            return (
              <div key={dow} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className={cn("text-sm font-medium", isToday ? "text-primary" : "text-ink")}>
                  {dayName(dow)}
                  {isToday && (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">Today</span>
                  )}
                </span>
                <span className="text-sm text-ink-2">
                  {entries.length > 0 ? (
                    entries.map((e) => `${clock12(e.open_time)} – ${clock12(e.close_time)}`).join(" · ")
                  ) : (
                    <span className="text-ink-3">Closed</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
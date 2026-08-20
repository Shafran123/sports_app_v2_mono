import * as React from "react";
import { MapPin, Star } from "lucide-react";
import { formatLkr, firstSportSlug } from "@spots/utils";
import type { Venue } from "@spots/types";
import { cn } from "@spots/utils";
import { VenueVisual } from "./venue-visual";

export function VenueCard({ venue, className, onFavorite, favorited }: { venue: Venue; className?: string; onFavorite?: () => void; favorited?: boolean }) {
  const location = [venue.city, venue.address].filter(Boolean).join(" · ");
  const slug = firstSportSlug(venue.sports as unknown[]);
  return (
    <div className={cn("press-raise group overflow-hidden rounded-3xl border border-border bg-surface shadow-soft", className)}>
      <div className="relative h-40 w-full overflow-hidden">
        <VenueVisual
          venue={venue as { photos?: unknown; sports?: unknown[] }}
          slug={slug}
          alt={venue.name}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
        />
        {onFavorite && (
          <button
            onClick={onFavorite}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink-2 shadow-soft transition-colors hover:text-error"
          >
            <Star className={cn("h-4 w-4", favorited && "fill-warning text-warning")} />
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold tracking-tight text-ink">{venue.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {location}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm">
            <span className="text-ink-3">from </span>
            <span className="font-display text-lg font-extrabold text-ink">{formatLkr(venue.min_price)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
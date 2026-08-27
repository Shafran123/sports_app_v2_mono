"use client";

// The widget's venue step (ADR-0028 v1.5, ticket 06): a compact venue picker
// shown when the instance lets customers choose and there are 2+ venues.
// The instance's Default Venue is preselected; picking another venue resets
// the booking flow (the parent remounts BookPanel with a new key).

import { Building2 } from "lucide-react";
import { cn } from "@myslot/utils";
import type { WidgetVenue } from "@myslot/types";

// The venue picker's row shape: whichever storefront supplies the venue list
// (the widget's WidgetVenue or a Dedicated Site's SiteVenue) must present at
// least these fields.
type VenueStepVenue = Pick<WidgetVenue, "id" | "name"> & {
  photos?: string[];
  sports?: string[];
  city?: string | null;
};

export function VenueStep({
  venues,
  selectedId,
  onSelect,
  hideLabel = false,
  flat = false
}: {
  venues: VenueStepVenue[];
  selectedId: string | null;
  onSelect: (venueId: string) => void;
  hideLabel?: boolean;
  flat?: boolean;
}) {
  const list = (
    <div className="space-y-1.5">
      {venues.map((venue) => {
        const active = venue.id === selectedId && selectedId !== null;
        return (
          <button
            key={venue.id}
            type="button"
            onClick={() => onSelect(venue.id)}
            aria-pressed={active}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
              active
                ? "border-primary/50 bg-primary-light text-ink"
                : "border-border bg-surface-2 text-ink hover:border-ink-3/40"
            )}
          >
            {venue.photos?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venue.photos[0]} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-3">
                <Building2 className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{venue.name}</span>
              <span className="block truncate text-xs text-ink-2">
                {venue.sports?.length ? venue.sports.join(" · ") : venue.city}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  if (flat) return list;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="rounded-3xl border border-border bg-surface p-3 shadow-soft">
        {!hideLabel && (
          <p className="flex items-center gap-1.5 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <Building2 className="h-3.5 w-3.5" /> Choose venue
          </p>
        )}
        {list}
      </div>
    </div>
  );
}
"use client";

// The iframe-friendly widget page: loads the instance's public config
// (reporting its parent origin so the server enforces the instance's domain
// allowlist), applies the Business's brand tokens, shows the venue selector
// when the instance allows it (Default Venue preselected), and renders the
// booking flow chrome-less. The branded page is rendered by the same
// BookPanel but never shows a venue step (it is per-venue by design).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { widget, toApiFailure } from "@myslot/api";
import { ErrorState, Skeleton } from "@myslot/ui";
import { ShieldX } from "lucide-react";
import { BookPanel } from "./book-panel";
import { VenueStep } from "./venue-step";
import { brandCssVars } from "./widget-theme";

export function WidgetEmbed({ widgetKey }: { widgetKey: string }) {
  const query = useQuery({
    queryKey: ["widget-config", widgetKey],
    queryFn: () => widget.config(widgetKey, { origin: parentOrigin() })
  });

  const config = query.data;
  const brand = config?.business.brand;
  const style = useMemo(() => brandCssVars(brand), [brand]);

  // The active venue: instance default when eligible, else the first eligible
  // venue (never a dead embed). The selector highlights only a real default —
  // a null default renders the step unselected ("no preselect", t06) while
  // the first venue stays the initially bookable surface.
  const venues = config?.venues ?? [];
  const [pickedVenueId, setPickedVenueId] = useState<string | null>(null);
  const defaultId = venues.some((v) => v.id === config?.instance.default_venue_id)
    ? config!.instance.default_venue_id!
    : null;
  const activeId = pickedVenueId ?? defaultId ?? venues[0]?.id ?? "";
  const activeVenue = venues.find((v) => v.id === activeId) ?? venues[0];
  const selectedId = pickedVenueId ?? defaultId;

  const showVenueStep = !!config && config.instance.allow_venue_choice && venues.length > 1;

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (query.isError || !config || !activeVenue) {
    const code = toApiFailure(query.error).code;
    if (code === "WIDGET_DOMAIN_NOT_ALLOWED") {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="max-w-sm rounded-3xl border border-border bg-surface p-8 text-center shadow-soft">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-light text-warning">
              <ShieldX className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-extrabold tracking-tight text-ink">
              Widget not authorized here
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              This booking widget is not enabled on this website. Ask the business owner to add
              this domain to their widget settings.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="p-4">
        <ErrorState
          title="Booking unavailable"
          message={toApiFailure(query.error).message}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  return (
    <div style={style}>
      {/* inline brand color tokens never leak to the host page (shadow DOM-like) */}
      <WidgetHeader business={config.business} venue={activeVenue} />
      {showVenueStep && (
        <VenueStep
          venues={venues}
          selectedId={selectedId}
          onSelect={(id) => setPickedVenueId(id)}
        />
      )}
      <div className="mx-auto max-w-lg px-4 pb-10">
        {/* key by venue: switching venues resets date/slot/selection state */}
        <BookPanel key={activeId} venue={activeVenue} instanceKey={widgetKey} />
      </div>
    </div>
  );
}

function WidgetHeader({
  business,
  venue
}: {
  business: { name: string; brand?: { tagline?: string; logo_url?: string } };
  venue: { name: string; photos?: string[]; city?: string; address?: string };
}) {
  return (
    <div className="mx-auto max-w-lg px-4 pt-5">
      <div className="flex items-center gap-3">
        {business.brand?.logo_url || venue.photos?.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.brand?.logo_url || venue.photos?.[0]!}
            alt=""
            className="h-11 w-11 shrink-0 rounded-2xl object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-extrabold tracking-tight text-ink">
            {business.name}
          </h1>
          {business.brand?.tagline ? (
            <p className="truncate text-xs text-ink-2">{business.brand.tagline}</p>
          ) : (
            <p className="text-xs text-ink-3">{venue.city}{venue.address ? ` · ${venue.address}` : ""}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// The parent origin the iframe is embedded on. document.referrer is the host
// page's URL for cross-origin frames; direct opens yield none (allowed, and
// treated as the branded-page experience).
function parentOrigin(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const ref = document.referrer;
  if (!ref) return undefined;
  try {
    return new URL(ref).origin;
  } catch {
    return undefined;
  }
}
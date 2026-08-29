"use client";

// The iframe-friendly widget page: loads the instance's public config
// (reporting its parent origin so the server enforces the instance's domain
// allowlist), applies the Business's brand tokens, shows the venue selector
// when the instance allows it (Default Venue preselected), and renders the
// booking flow chrome-less. The branded page is rendered by the same
// BookPanel but never shows a venue step (it is per-venue by design).

import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { widget, featureFlags, auth as authApi, toApiFailure, siteCustomerAuth, persistSiteToken, TOKEN_KEY, SITE_GOOGLE_PENDING_KEY, SITE_TOTP_PENDING_KEY, SITE_AUTH_ERROR_KEY } from "@myslot/api";
import { ErrorState, Skeleton } from "@myslot/ui";
import { DEFAULT_BRAND_NAME } from "@myslot/utils";
import { finishGoogleRedirect, toAppUser } from "@myslot/auth";
import { ShieldX } from "lucide-react";
import { BookPanel } from "./book-panel";
import { VenueStep } from "./venue-step";
import { WidgetBookings } from "./widget-bookings";
import { brandCssVars } from "./widget-theme";
import { useAuth } from "@/context/auth";

export function WidgetEmbed({ widgetKey }: { widgetKey: string }) {
  const { user, logout, setUser } = useAuth();
  const query = useQuery({
    queryKey: ["widget-config", widgetKey],
    queryFn: () => widget.config(widgetKey, { origin: parentOrigin() })
  });

  // Bumping this on sign-out remounts the booking flow so it lands back on
  // the identity step instead of showing the picker with a null user.
  const [sessionKey, setSessionKey] = useState(0);

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setShowBookings(false);
    setSessionKey((k) => k + 1);
  };

  // Settle a Firebase Google redirect sign-in that this embed initiated
  // (the widget uses redirect, not popup — cross-origin iframes block
  // popups). The browser returns to this same URL after Google auth. The
  // Firebase token is a throwaway identity: on a Business's live site it is
  // exchanged for that Business's Site Customer (ADR-0030), on the marketplace
  // path it becomes the platform token.
  useEffect(() => {
    void (async () => {
      const settled = await finishGoogleRedirect();
      if (!settled) return;
      const { idToken } = settled;
      const pendingHost =
        typeof window !== "undefined" ? window.sessionStorage.getItem(SITE_GOOGLE_PENDING_KEY) : null;
      if (pendingHost) {
        window.sessionStorage.removeItem(SITE_GOOGLE_PENDING_KEY);
        try {
          const session = await siteCustomerAuth.google({ site_hostname: pendingHost, id_token: idToken });
          if ("escalated" in session) {
            // Enrolled customer: the Second Factor challenge comes back
            // instead of a session (ticket 08). Park it for WidgetIdentity
            // to pick up on mount, then settle into the sign-in surface.
            window.sessionStorage.setItem(SITE_TOTP_PENDING_KEY, JSON.stringify(session));
            window.location.reload();
            return;
          }
          persistSiteToken(session.token);
          setUser(toAppUser(session.customer));
        } catch (err) {
          // A Business that requires the Second Factor refuses an unenrolled
          // customer — park the message so the identity step can explain
          // (ticket 09), then settle into the sign-in surface. Any other
          // failure just drops the identity for a fresh attempt.
          if (toApiFailure(err).code === "SECOND_FACTOR_REQUIRED") {
            window.sessionStorage.setItem(
              SITE_AUTH_ERROR_KEY,
              JSON.stringify({ message: toApiFailure(err).message })
            );
            window.location.reload();
            return;
          }
        }
        return;
      }
      if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, idToken);
      window.location.reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = query.data;
  const brand = config?.business.brand;
  const style = useMemo(() => brandCssVars(brand), [brand]);

  // The active venue: instance default when eligible, else the first eligible
  // venue (never a dead embed). The selector highlights only a real default —
  // a null default renders the step unselected ("no preselect", t06) while
  // the first venue stays the initially bookable surface.
  const venues = config?.venues ?? [];
  const [pickedVenueId, setPickedVenueId] = useState<string | null>(null);
  const [showBookings, setShowBookings] = useState(false);
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
      <WidgetHeader
        business={config.business}
        venue={activeVenue}
        showVenueName={!showVenueStep}
        action={
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex max-w-44 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-2">
                <span className="truncate">
                  Signed in as{" "}
                  <span className="font-semibold text-ink">
                    {user.name || user.phone || user.email}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="shrink-0 font-semibold text-ink-3 underline-offset-2 hover:text-error hover:underline"
                >
                  Sign out
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowBookings((v) => !v)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              {showBookings ? "Back to booking" : "Your bookings"}
            </button>
          </div>
        }
      />
      {showBookings ? (
        <WidgetBookings
          widgetKey={widgetKey}
          venue={activeVenue}
          siteHostname={config?.business.site_hostname ?? null}
          onBack={() => setShowBookings(false)}
        />
      ) : (
        <>
          {showVenueStep && (
            <VenueStep
              venues={venues}
              selectedId={selectedId}
              onSelect={(id) => setPickedVenueId(id)}
            />
          )}
          <div className="mx-auto max-w-lg px-4 pb-10">
            {/* key by venue+session: switching venues resets slot state, and
                sign-out remounts so the identity step shows again */}
            <BookPanel
              key={`${activeId}-${sessionKey}`}
              venue={activeVenue}
              instanceKey={widgetKey}
              siteHostname={config?.business.site_hostname ?? null}
            />
          </div>
        </>
      )}
      <WidgetAttribution />
    </div>
  );
}

// "Powered by MySlot.LK" attribution: always on, opens the platform home in
// the top-level frame (the embed's host page is a different origin).
function WidgetAttribution() {
  const { data: flags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlags.get()
  });
  const brand = flags?.brand_name ?? DEFAULT_BRAND_NAME;
  const href =
    flags?.app_url || (typeof window !== "undefined" ? window.location.origin : undefined);
  return (
    <div className="px-4 pb-8">
      <a
        href={href}
        target="_top"
        rel="noopener"
        className="block text-center text-xs text-ink-3 transition-colors hover:text-ink-2"
      >
        Powered by <span className="font-semibold">{brand}</span>
      </a>
    </div>
  );
}

function WidgetHeader({
  business,
  venue,
  showVenueName,
  action
}: {
  business: { name: string; brand?: { tagline?: string; logo_url?: string } };
  venue: { name: string; photos?: string[]; city?: string; address?: string };
  showVenueName?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 pt-5">
      <div className="flex items-center gap-3">
        {business.brand?.logo_url || venue.photos?.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.brand?.logo_url || venue.photos?.[0]!}
            alt=""
            className="h-12 w-12 shrink-0 rounded-2xl object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            {business.name}
          </p>
          {showVenueName ? (
            // The venue step is hidden (locked or single-venue): the venue is
            // the only bookable option, so its name leads the header.
            <h1 className="truncate font-display text-lg font-extrabold leading-tight tracking-tight text-ink">
              {venue.name}
            </h1>
          ) : (
            <h1 className="truncate font-display text-lg font-extrabold leading-tight tracking-tight text-ink">
              {business.brand?.tagline || venue.name}
            </h1>
          )}
        </div>
        {action}
      </div>
      {showVenueName && (venue.city || venue.address) && (
        <p className="mt-1.5 truncate text-xs text-ink-3">
          {[venue.address, venue.city].filter(Boolean).join(", ")}
        </p>
      )}
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
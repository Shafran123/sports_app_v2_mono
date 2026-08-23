"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { events, featureFlags } from "@myslot/api";
import { Badge, Card, ErrorState, Progress, Skeleton, VenueVisual } from "@myslot/ui";
import { eventVisualSrc, formatDateLong, formatTime12, DEFAULT_BRAND_NAME } from "@myslot/utils";
import { useAuth } from "@/context/auth";
import { RegistrationCard } from "./registration-card";
import { OrganizerTools } from "./organizer-tools";

export function EventDetailPage({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const { data: flags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlags.get()
  });
  const { data: event, isLoading, isError, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => events.detail(eventId)
  });

  const discovery = flags?.events_discovery_state ?? "enabled";

  if (isLoading || !event) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
        <ErrorState
          title="Could not load this event"
          message="We could not load this event right now. Please try again."
          onRetry={() => refetch()}
        />
      </main>
    );
  }

  const cancelled = event.status === "cancelled";
  const capacity = Number(event.capacity) || 0;
  const registered = Number(event.registrations_count) || 0;
  const full = capacity > 0 && registered >= capacity;
  const left = Math.max(0, capacity - registered);
  const spotsPct = capacity > 0 ? (registered / capacity) * 100 : 0;
  const almostFull = capacity > 0 && !full && left / capacity < 0.25;
  const isOrganizer = user?.role === "venue_owner" || user?.role === "admin";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
      <section className="relative overflow-hidden rounded-3xl border border-border shadow-soft">
        <VenueVisual
          src={eventVisualSrc(event)}
          slug={event.sport_slug}
          alt={event.title}
          w={1200}
          h={640}
          className="h-72 w-full md:h-96 object-cover"
        />
        {cancelled && (
          <div className="absolute inset-x-0 top-0 z-10 bg-error/90 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm">
            This event has been cancelled
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent p-6 md:p-8">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">{event.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {event.sport_name && <Badge variant="primary">{event.sport_name}</Badge>}
            {cancelled ? <Badge variant="error">Cancelled</Badge> : full ? <Badge variant="warning">Full</Badge> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/90">
            {event.venue_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {event.venue_name}
              </span>
            )}
            {event.city && <span className="inline-flex items-center gap-1 text-white/90">{event.city}</span>}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {formatDateLong(event.start_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatTime12(event.start_at)}
              {event.end_at ? ` – ${formatTime12(event.end_at)}` : ""}
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold tracking-tight text-ink">About this event</h2>
            <p className="mt-2 whitespace-pre-line text-ink-2">{event.description || "No description provided yet."}</p>
          </Card>
          {capacity > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold tracking-tight text-ink">Availability</h2>
                <span className="text-sm font-medium text-ink-2">
                  {registered} of {capacity} spots
                </span>
              </div>
              <Progress
                value={spotsPct}
                tone={full || almostFull ? "warning" : "primary"}
                className="mt-2"
              />
              <p className="mt-2 text-sm text-ink-2">
                {full
                  ? "All spots are taken."
                  : almostFull
                    ? `Only ${left} ${left === 1 ? "spot" : "spots"} left!`
                    : `${left} ${left === 1 ? "spot" : "spots"} remaining.`}
              </p>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {discovery !== "enabled" ? (
            <Card className="p-6">
              <h3 className="font-semibold tracking-tight text-ink">Not available yet</h3>
              <p className="mt-1 text-sm text-ink-2">
                Event listings are paused by {flags?.brand_name ?? DEFAULT_BRAND_NAME} — registrations open once the event goes
                live.
              </p>
            </Card>
          ) : (
            <RegistrationCard event={event} user={user} />
          )}
          {isOrganizer && <OrganizerTools event={event} />}
        </aside>
      </div>
    </main>
  );
}
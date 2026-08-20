import * as React from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { formatLkr, eventVisualSrc } from "@spots/utils";
import type { Event } from "@spots/types";
import { cn } from "@spots/utils";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { VenueVisual } from "./venue-visual";
import { Progress } from "../ui/progress";

export function ActivityCard({ event, className, onAction }: { event: Event; className?: string; onAction?: () => void }) {
  const capacity = Number(event.capacity) || 0;
  const registered = Number(event.registrations_count) || 0;
  const full = capacity > 0 && registered >= capacity;
  const start = new Date(event.start_at);
  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="relative h-36 w-full overflow-hidden">
        <VenueVisual
          src={eventVisualSrc(event)}
          slug={event.sport_slug}
          alt={event.title}
          className="h-full w-full"
        />
        {event.status === "cancelled" && <Badge variant="error" className="absolute left-3 top-3">Cancelled</Badge>}
        {!event.status.includes("cancelled") && full && <Badge variant="warning" className="absolute left-3 top-3">Full</Badge>}
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold tracking-tight text-ink">{event.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-2">
          <CalendarDays className="h-3.5 w-3.5" />
          {start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          <Clock className="ml-2 h-3.5 w-3.5" />
          {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
        {event.venue_name && (
          <p className="mt-1 flex items-center gap-1 truncate text-sm text-ink-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {event.venue_name}
          </p>
        )}
        {capacity > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-ink-2">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {registered}/{capacity} players
              </span>
              <span>{Math.round((registered / capacity) * 100)}%</span>
            </div>
            <Progress value={(registered / capacity) * 100} tone={full ? "warning" : "primary"} className="mt-1.5" />
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-lg font-extrabold text-ink">
            {event.price > 0 ? `${formatLkr(event.price)} / player` : "Free"}
          </span>
          {onAction && (
            <button onClick={onAction} className="text-sm font-semibold text-primary hover:underline">
              View
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
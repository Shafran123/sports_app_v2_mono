import * as React from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { formatLkr } from "@myslot/utils";
import type { Booking } from "@myslot/types";
import { cn } from "@myslot/utils";
import { StatusPill } from "../ui/badge";
import { Card } from "../ui/card";

export function BookingCard({
  booking,
  className,
  onAction,
  actionLabel
}: {
  booking: Booking;
  className?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{booking.venue_name}</p>
          <p className="mt-0.5 text-sm text-ink-2">
            {booking.court_name}
            {booking.sport ? ` · ${booking.sport}` : ""}
          </p>
        </div>
        <StatusPill status={booking.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–
          {end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        {booking.venue_city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {booking.venue_city}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-lg font-extrabold text-ink">{formatLkr(booking.total_price)}</span>
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-sm font-semibold text-primary hover:underline">
            {actionLabel}
          </button>
        )}
      </div>
    </Card>
  );
}
"use client";

import { Card, EmptyState, ErrorState, Skeleton, SLOT_STATE_LABEL, SLOT_STATE_STYLES } from "@myslot/ui";
import { cn, formatLkr, formatTime12 } from "@myslot/utils";
import type { Availability, CourtAvailability, Slot } from "@myslot/types";

function AvailabilitySkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-1.5 h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="mt-3 flex gap-1.5 overflow-hidden">
            {Array.from({ length: 12 }).map((_, j) => (
              <Skeleton key={j} className="h-9 w-16 shrink-0 rounded-xl" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Legend({ courts }: { courts: CourtAvailability[] }) {
  const present = new Set<string>();
  courts.forEach((c) => c.slots.forEach((s) => present.add(s.state)));

  const items = [
    { state: "available", color: "bg-primary", label: "Available" },
    { state: "held", color: "bg-warning", label: SLOT_STATE_LABEL.held },
    { state: "booked", color: "bg-error", label: SLOT_STATE_LABEL.booked },
    { state: "blocked", color: "bg-ink-3", label: SLOT_STATE_LABEL.blocked },
    { state: "past", color: "bg-ink-3/50", label: "Past / outside window" }
  ].filter((item) => present.has(item.state));

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-ink-3">
      {items.map((item) => (
        <span key={item.state} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", item.color)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function AvailabilityView({
  availability,
  isLoading,
  isError,
  onRetry,
  onSlotClick
}: {
  availability: Availability | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSlotClick: (court: CourtAvailability, slot: Slot) => void;
}) {
  if (isLoading) return <AvailabilitySkeleton />;

  if (isError) {
    return (
      <ErrorState
        title="Could not load availability"
        message="Something went wrong while fetching slots. Please try again."
        onRetry={onRetry}
      />
    );
  }

  const courts = availability?.courts ?? [];
  if (courts.length === 0) {
    return (
      <EmptyState
        title="No slots on this day"
        message="This venue has no bookable slots for the selected date."
      />
    );
  }

  return (
    <div className="space-y-4">
      {courts.map((court) => (
        <Card key={court.court_id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold tracking-tight text-ink">{court.name}</h3>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
                {court.sport ?? "Court"} · {court.slot_duration_min} min slots
              </p>
            </div>
            <p className="font-display text-base font-extrabold text-ink">
              {formatLkr(court.price_per_slot)} <span className="text-xs font-medium text-ink-3">/ slot</span>
            </p>
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
            {court.slots.map((slot) => {
              const clickable = slot.state === "available" || slot.state === "booked";
              return (
                <button
                  key={slot.start_at}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSlotClick(court, slot)}
                  aria-label={`${court.name}, ${SLOT_STATE_LABEL[slot.state]}, ${formatTime12(slot.start_at)}`}
                  className={cn(
                    "w-16 shrink-0 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors lg:w-auto lg:flex-1",
                    SLOT_STATE_STYLES[slot.state]
                  )}
                >
                  {formatTime12(slot.start_at)}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      <Legend courts={courts} />
    </div>
  );
}
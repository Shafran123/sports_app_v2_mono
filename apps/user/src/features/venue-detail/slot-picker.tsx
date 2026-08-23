"use client";

import { Card, ErrorState, EmptyState, Skeleton, SLOT_STATE_STYLES, SLOT_STATE_LABEL } from "@myslot/ui";
import { cn, formatLkr, formatTime12 } from "@myslot/utils";
import type { Availability, CourtAvailability, Slot } from "@myslot/types";
import { selectionKey, type SelectedSlots } from "./selection";

const GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";

function AvailabilitySkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1].map((i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className={cn("mt-4", GRID)}>
            {Array.from({ length: 12 }).map((_, j) => (
              <Skeleton key={j} className="h-9 rounded-2xl" />
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

export function SlotPicker({
  availability,
  isLoading,
  isError,
  onRetry,
  selected,
  onToggle
}: {
  availability: Availability | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selected: SelectedSlots;
  onToggle: (court: CourtAvailability, slot: Slot) => void;
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
        title="No slots available"
        message="This venue does not open on the selected day."
      />
    );
  }

  return (
    <div className="space-y-5">
      {courts.map((court) => (
        <Card key={court.court_id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
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

          <div className={cn("mt-4", GRID)}>
            {court.slots.map((slot) => {
              const isSelected = !!selected[selectionKey(court.court_id, slot.start_at)];
              const clickable = slot.state === "available" || isSelected;
              const hint =
                !isSelected && (slot.state === "held" || slot.state === "booked" || slot.state === "blocked")
                  ? SLOT_STATE_LABEL[slot.state]
                  : null;
              return (
                <button
                  key={slot.start_at}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onToggle(court, slot)}
                  aria-pressed={isSelected}
                  aria-label={`${court.name}, ${formatTime12(slot.start_at)}${hint ? `, ${hint}` : ""}`}
                  className={cn(
                    "press flex flex-col items-center rounded-2xl border px-1.5 py-2 text-xs font-semibold transition-colors",
                    SLOT_STATE_STYLES[isSelected ? "selected" : slot.state],
                    isSelected && "shadow-soft"
                  )}
                >
                  <span className="font-display text-[11px] font-bold tabular-nums">
                    {formatTime12(slot.start_at)}
                  </span>
                  {hint && <span className="mt-0.5 text-[9px] font-medium leading-none">{hint}</span>}
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
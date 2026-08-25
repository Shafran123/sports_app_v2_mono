"use client";

import { EmptyState, ErrorState, Skeleton, SLOT_STATE_STYLES, SLOT_STATE_LABEL } from "@myslot/ui";
import { cn, formatLkr, formatTime12 } from "@myslot/utils";
import type { Availability, CourtAvailability, Slot } from "@myslot/types";
import { selectionKey, type SelectedSlots } from "./selection";

const GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";

function AvailabilitySkeleton() {
  return (
    <div className={cn("mt-4", GRID)}>
      {Array.from({ length: 8 }).map((_, j) => (
        <Skeleton key={j} className="h-9 rounded-2xl" />
      ))}
    </div>
  );
}

function Legend({ court }: { court: CourtAvailability }) {
  const present = new Set<string>();
  court.slots.forEach((s) => present.add(s.state));

  const items = [
    { state: "held", color: "bg-warning", label: SLOT_STATE_LABEL.held },
    { state: "booked", color: "bg-error", label: SLOT_STATE_LABEL.booked },
    { state: "blocked", color: "bg-ink-3", label: SLOT_STATE_LABEL.blocked }
  ].filter((item) => present.has(item.state));

  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-ink-3">
      {items.map((item) => (
        <span key={item.state} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", item.color)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Renders only the slot grid for the given courts — the surrounding Card and
// court header/price live in the parent (CourtCards), so a court is never
// shown twice.
export function SlotPicker({
  availability,
  isLoading,
  isError,
  onRetry,
  selected,
  onToggle,
  slotsCount
}: {
  availability: Availability | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selected: SelectedSlots;
  onToggle: (court: CourtAvailability, slot: Slot) => void;
  slotsCount: number;
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
    return <EmptyState title="No slots available" message="This venue is closed on the selected day." />;
  }

  return (
    <div className="space-y-5">
      {courts.map((court) => (
        <div key={court.court_id}>
          <div className={GRID}>
            {court.slots.map((slot) => {
              const key = selectionKey(court.court_id, slot.start_at);
              const isSelected = !!selected[key];
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
                  aria-label={`${court.name}, ${formatTime12(slot.start_at)}, ${slotsCount} slot run${hint ? `, ${hint}` : ""}`}
                  className={cn(
                    "press flex flex-col items-center rounded-2xl border px-1.5 py-2 text-xs font-semibold transition-colors",
                    SLOT_STATE_STYLES[isSelected ? "selected" : slot.state],
                    isSelected && "shadow-soft"
                  )}
                >
                  <span className="font-display text-[11px] font-bold tabular-nums">
                    {formatTime12(slot.start_at)}
                  </span>
                  {slot.offer_price != null && slot.price != null && slot.offer_price < slot.price ? (
                    <span className="mt-0.5 flex flex-col items-center leading-none">
                      <span className="text-[9px] font-medium text-ink-3 line-through">{formatLkr(slot.price)}</span>
                      <span className="text-[9px] font-bold text-primary">{formatLkr(slot.offer_price)}</span>
                    </span>
                  ) : (
                    <span className="mt-0.5 text-[9px] font-medium text-ink-2">
                      {formatLkr(slot.price ?? court.price_per_slot)}
                    </span>
                  )}
                  {hint && <span className="mt-0.5 text-[9px] font-medium leading-none">{hint}</span>}
                </button>
              );
            })}
          </div>
          <Legend court={court} />
        </div>
      ))}
    </div>
  );
}
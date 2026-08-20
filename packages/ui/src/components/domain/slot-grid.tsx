"use client";

import * as React from "react";
import type { CourtAvailability, SlotState } from "@spots/types";
import { cn } from "@spots/utils";

export const SLOT_STATE_STYLES: Record<string, string> = {
  available:
    "border-border bg-surface text-ink hover:border-primary hover:bg-primary-light hover:text-primary",
  selected: "border-primary bg-primary text-white hover:bg-primary-hover",
  past: "border-border/60 bg-surface-2/50 text-ink-3 line-through cursor-not-allowed",
  outside_window: "border-border/60 bg-surface-2/40 text-ink-3/60 cursor-not-allowed",
  held: "border-warning/40 bg-warning-light/50 text-warning cursor-not-allowed",
  blocked: "border-border bg-surface-2 text-ink-3/70 cursor-not-allowed",
  booked: "border-border bg-error-light/50 text-error cursor-not-allowed"
};

export const SLOT_STATE_LABEL: Record<string, string> = {
  available: "Available",
  selected: "Selected",
  past: "Past",
  outside_window: "Outside window",
  held: "Held",
  blocked: "Blocked",
  booked: "Booked"
};

export function SlotGrid({
  courts,
  selectedSlots,
  onToggle,
  className
}: {
  courts: CourtAvailability[];
  selectedSlots: Record<string, { start: string; end: string }>;
  onToggle: (courtId: string, start: string, end: string, state: SlotState) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {courts.map((court) => (
        <div key={court.court_id}>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="font-semibold text-ink">{court.name}</h4>
            <span className="text-sm text-ink-3">
              {court.sport} · {court.slot_duration_min} min
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {court.slots.map((slot, i) => {
              const key = `${court.court_id}:${slot.start_at}`;
              const selected = !!selectedSlots[key];
              const clickable = ["available", "selected"].includes(slot.state);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onToggle(court.court_id, slot.start_at, slot.end_at, slot.state)}
                  aria-pressed={selected}
                  aria-label={`${court.name} ${new Date(slot.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                  className={cn(
                    "rounded-2xl border px-2 py-2.5 text-xs font-semibold transition-colors",
                    SLOT_STATE_STYLES[selected ? "selected" : slot.state]
                  )}
                >
                  {new Date(slot.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
"use client";

import { cn } from "@myslot/utils";
import type { BookingStatus } from "@myslot/types";

const FLOW: { status: BookingStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "confirmed", label: "Confirmed" },
  { status: "checked_in", label: "Checked in" },
  { status: "completed", label: "Completed" }
];

const TERMINAL: Partial<Record<BookingStatus, { label: string; tone: string }>> = {
  cancelled: { label: "Cancelled", tone: "bg-error-light text-error" },
  no_show: { label: "No-show", tone: "bg-surface-2 text-ink-2" },
  failed: { label: "Failed", tone: "bg-error-light text-error" }
};

export function BookingStatusSteps({ status, className }: { status: BookingStatus; className?: string }) {
  const terminal = TERMINAL[status];
  const currentIndex = FLOW.findIndex((s) => s.status === status);
  const reachedIndex = terminal
    ? status === "failed"
      ? 0
      : FLOW.findIndex((s) => s.status === "confirmed")
    : currentIndex;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center">
        {FLOW.map((step, i) => (
          <div key={step.status} className={cn("flex items-center", i < FLOW.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                  i < reachedIndex
                    ? "border-primary bg-primary text-white"
                    : i === reachedIndex && !terminal
                      ? "border-primary bg-primary-light text-primary"
                      : i === reachedIndex
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-ink-3"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-semibold",
                  i <= reachedIndex ? "text-ink" : "text-ink-3"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < FLOW.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-5 h-0.5 flex-1 rounded-full",
                  i < reachedIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {terminal && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Outcome</span>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", terminal.tone)}>{terminal.label}</span>
        </div>
      )}
    </div>
  );
}
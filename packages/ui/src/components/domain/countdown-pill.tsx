"use client";

import * as React from "react";
import { cn } from "@spots/utils";

export function CountdownPill({ seconds, className }: { seconds: number; className?: string }) {
  const critical = seconds <= 60;
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return (
    <span
      role="timer"
      aria-label={`${m} minutes ${s} seconds remaining`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums transition-colors",
        critical ? "animate-pulse bg-error-light text-error" : "bg-surface-2 text-ink-2",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {m}:{s}
    </span>
  );
}
import * as React from "react";
import { cn } from "@myslot/utils";

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "warning" | "error" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "primary" && "bg-primary",
          tone === "warning" && "bg-warning",
          tone === "error" && "bg-error"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
"use client";

import { cn } from "@myslot/utils";
import { useSocketStatus } from "@/hooks/use-realtime";

const COPY = {
  connecting: {
    label: "Connecting…",
    tone: "border-warning/40 bg-warning-light text-warning",
    dot: "bg-warning animate-pulse"
  },
  connected: {
    label: "Live",
    tone: "border-success/40 bg-success-light text-success",
    dot: "bg-success"
  },
  disconnected: {
    label: "Offline — not receiving updates",
    tone: "border-error/40 bg-error-light text-error",
    dot: "bg-error animate-pulse"
  }
} as const;

// Connection state of the realtime bridge, so the front desk never silently
// acts on stale data: when the socket drops, updates stop pushing and the badge
// turns red; on reconnect the bridge refetches and everything catches up.
export function SocketStatusBadge() {
  const status = useSocketStatus();
  const c = COPY[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", c.tone)}
      role="status"
      title={status === "disconnected" ? "Connection lost — refreshing on reconnect" : undefined}
    >
      <span className={cn("h-2 w-2 rounded-full", c.dot)} aria-hidden="true" />
      {c.label}
    </span>
  );
}

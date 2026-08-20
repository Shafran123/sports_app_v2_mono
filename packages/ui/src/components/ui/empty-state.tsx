import * as React from "react";
import { SearchX } from "lucide-react";
import { cn } from "@spots/utils";
import { Button } from "./button";

export function EmptyState({
  title = "Nothing here yet",
  message,
  actionLabel,
  onAction,
  icon: Icon = SearchX,
  className
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-2">{message}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
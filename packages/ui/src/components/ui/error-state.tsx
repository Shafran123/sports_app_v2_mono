import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@spots/utils";
import { Button } from "./button";

export function ErrorState({
  title = "Something went wrong",
  message = "We could not load this right now. Please try again.",
  onRetry,
  className
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-error/20 bg-error-light/40 px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-error">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-5">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}
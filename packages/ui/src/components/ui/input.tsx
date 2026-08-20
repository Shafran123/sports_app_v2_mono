import * as React from "react";
import { cn } from "@spots/utils";

export function Input({ className, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border bg-surface px-4 text-sm text-ink placeholder:text-ink-3 transition-colors",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
        error ? "border-error focus:border-error focus:ring-error/20" : "border-border",
        className
      )}
      {...props}
    />
  );
}
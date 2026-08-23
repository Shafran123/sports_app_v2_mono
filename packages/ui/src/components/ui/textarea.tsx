import * as React from "react";
import { cn } from "@myslot/utils";

export function Textarea({ className, error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-3 transition-colors",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
        error ? "border-error focus:border-error" : "border-border",
        className
      )}
      {...props}
    />
  );
}
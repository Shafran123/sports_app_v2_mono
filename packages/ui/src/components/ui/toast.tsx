"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@spots/utils";

export type ToastTone = "success" | "error" | "info";

const TONE_STYLES: Record<ToastTone, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  success: { icon: CheckCircle2, cls: "border-success/30 text-success" },
  error: { icon: AlertCircle, cls: "border-error/30 text-error" },
  info: { icon: Info, cls: "border-accent/30 text-accent" }
};

export function ToastViewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {children}
    </div>
  );
}

export function Toast({ tone = "info", title, message, onDismiss }: { tone?: ToastTone; title: string; message?: string; onDismiss?: () => void }) {
  const t = TONE_STYLES[tone];
  const Icon = t.icon;
  return (
    <div className="animate-fade-up pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lift" role="status">
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", t.cls)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {message && <p className="mt-0.5 text-sm text-ink-2">{message}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="rounded-full p-1 text-ink-3 hover:bg-surface-2">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
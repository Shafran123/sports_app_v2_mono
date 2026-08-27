import * as React from "react";
import { cn } from "@myslot/utils";
import { getScreenshot, resolveScreenshot, type FrameKind } from "@/lib/screenshots";

interface DeviceFrameProps {
  shotId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a feature's screenshot slot. A real screenshot (screenshots.ts
 * entry gains a `src`) renders plainly — the capture already includes its own
 * device bezel — otherwise the caller's mockup children render inside a
 * CSS-composed phone, tablet, or browser frame.
 */
export function DeviceFrame({ shotId, children, className }: DeviceFrameProps) {
  const shot = getScreenshot(shotId);
  const src = resolveScreenshot(shot);
  const frame = (shot?.frame ?? "browser") as FrameKind;

  if (src) {
    return (
      <figure
        className={cn(
          "overflow-hidden rounded-3xl border border-border bg-surface shadow-soft",
          frame === "phone" ? "mx-auto w-[320px]" : "w-full",
          className
        )}
      >
        <img src={src} alt={`Screenshot: ${shot?.label ?? shotId}`} className="block h-auto w-full" />
      </figure>
    );
  }

  if (frame === "phone") {
    return (
      <figure className={cn("mx-auto w-[300px] rounded-[2.5rem] bg-ink p-2.5 shadow-soft", className)}>
        <div className="relative h-[calc(100%-1.25rem)] overflow-hidden rounded-[2rem]">
          <span aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
          <div className="h-full bg-paper p-3">{children}</div>
        </div>
      </figure>
    );
  }

  if (frame === "tablet") {
    return (
      <figure className={cn("mx-auto w-full max-w-[560px] rounded-[2.5rem] bg-ink p-2.5 shadow-soft", className)}>
        <div className="relative overflow-hidden rounded-[2rem]">
          <span aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-2 w-2 -translate-x-1/2 rounded-full bg-ink-3" />
          <div className="bg-paper p-4">{children}</div>
        </div>
      </figure>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-3xl border border-border bg-surface shadow-soft overflow-hidden",
        "w-full",
        className
      )}
    >
      <FrameChrome frame="browser" label={shot?.label ?? shotId} />
      <div className="bg-paper">{children}</div>
    </div>
  );
}

function FrameChrome({ frame, label }: { frame: FrameKind; label: string }) {
  if (frame === "phone" || frame === "tablet") {
    return (
      <div className="flex justify-center border-b border-border bg-surface py-2">
        <span className="h-1.5 w-16 rounded-full bg-ink-3" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-surface px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-error" aria-hidden="true" />
      <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden="true" />
      <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
      <span className="ml-2 truncate text-[11px] text-ink-3">{label}</span>
    </div>
  );
}
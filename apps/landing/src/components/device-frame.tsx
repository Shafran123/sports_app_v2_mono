import * as React from "react";
import { cn } from "@myslot/utils";
import { getScreenshot, resolveScreenshot, type FrameKind } from "@/lib/screenshots";

interface DeviceFrameProps {
  shotId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a feature's screenshot slot inside a phone or browser device frame.
 * A real screenshot (screenshots.ts entry gains a `src`) renders as an image;
 * otherwise the caller's mockup children render inside the frame.
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
          frame === "phone" ? "mx-auto w-[300px] aspect-[9/19]" : "w-full aspect-[16/10]",
          className
        )}
      >
        <img src={src} alt={`Screenshot: ${shot?.label ?? shotId}`} className="h-full w-full object-cover" />
      </figure>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-3xl border border-border bg-surface shadow-soft overflow-hidden",
        frame === "phone" ? "mx-auto w-[300px]" : "w-full",
        className
      )}
    >
      <FrameChrome frame={frame} label={shot?.label ?? shotId} />
      <div className={cn(frame === "phone" ? "bg-paper p-3" : "bg-paper")}>{children}</div>
    </div>
  );
}

function FrameChrome({ frame, label }: { frame: FrameKind; label: string }) {
  if (frame === "phone") {
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
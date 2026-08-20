"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@spots/ui";
import { cn, formatLkr, formatTime12 } from "@spots/utils";
import type { SelectionSummary } from "./selection";

function ContinueButton({ count, total, href, className }: { count: number; total: number; href: string; className?: string }) {
  if (count > 0 && href) {
    return (
      <Link href={href} className={cn(buttonVariants({ variant: "primary", size: "lg" }), className)}>
        Continue · {formatLkr(total)}
      </Link>
    );
  }
  return (
    <Button variant="primary" size="lg" disabled className={className}>
      Continue
    </Button>
  );
}

export function BookingCta({
  summary,
  href,
  dateLabel,
  stacked,
  className
}: {
  summary: SelectionSummary;
  href: string;
  dateLabel: string;
  stacked?: boolean;
  className?: string;
}) {
  const { count, total, courtName, startAt, endAt } = summary;
  const timeRange = startAt && endAt ? `${formatTime12(startAt)} – ${formatTime12(endAt)}` : null;

  return (
    <div className={cn(stacked ? "flex flex-col gap-4" : "flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        {count > 0 ? (
          <>
            <p className="truncate text-sm text-ink-2">
              {[courtName, dateLabel, timeRange].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-0.5 font-display text-base font-extrabold text-ink">
              {formatLkr(total)}{" "}
              <span className="text-xs font-medium text-ink-3">
                {count} slot{count === 1 ? "" : "s"}
              </span>
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-3">Select up to 8 consecutive slots on one court to book.</p>
        )}
      </div>
      <ContinueButton
        count={count}
        total={total}
        href={href}
        className={stacked ? "w-full" : "shrink-0"}
      />
    </div>
  );
}
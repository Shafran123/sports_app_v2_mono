import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@myslot/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-ink-2 border border-border",
        primary: "bg-primary-light text-primary",
        accent: "bg-accent-light text-accent",
        success: "bg-success-light text-success",
        warning: "bg-warning-light text-warning",
        error: "bg-error-light text-error",
        outline: "bg-surface text-ink border border-border"
      }
    },
    defaultVariants: { variant: "neutral" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_TONE: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
  pending: "warning",
  confirmed: "primary",
  completed: "accent",
  cancelled: "error",
  cancelled_by_user: "error",
  cancelled_by_owner: "error",
  cancelled_by_admin: "error",
  cancelled_auto: "error",
  no_show: "neutral",
  due: "warning",
  paid: "success",
  refunded: "neutral",
  failed: "error",
  active: "success",
  approved: "success",
  rejected: "error"
};

// Human title-case label for a status code, shared across every surface so
// the console, the app and the widget never disagree on wording. Unknown
// statuses humanize into title case ("some_unknown" -> "Some Unknown").
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  cancelled_by_user: "Cancelled by user",
  cancelled_by_owner: "Cancelled by venue",
  cancelled_by_admin: "Cancelled by admin",
  cancelled_auto: "Auto-cancelled",
  no_show: "No-show",
  due: "Due",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
  active: "Active",
  approved: "Approved",
  rejected: "Rejected",
  online: "PayHere",
  payhere: "PayHere",
  card: "Card",
  cash: "Cash"
};

function humanizeTitle(value: string) {
  return value
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? humanizeTitle(status);
}

export function StatusPill({ status, children, className }: { status: string; children?: React.ReactNode; className?: string }) {
  const label = children ?? statusLabel(status);
  return (
    <Badge variant={STATUS_TONE[status] ?? "neutral"} className={className}>
      {label}
    </Badge>
  );
}
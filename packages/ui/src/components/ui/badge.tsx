import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@spots/utils";

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
  checked_in: "accent",
  completed: "neutral",
  cancelled: "error",
  no_show: "neutral",
  failed: "error",
  active: "success",
  approved: "success",
  rejected: "error",
  paid: "success",
  refunded: "neutral"
};

export function StatusPill({ status, children, className }: { status: string; children?: React.ReactNode; className?: string }) {
  const label = children ?? status.replaceAll("_", " ");
  return (
    <Badge variant={STATUS_TONE[status] ?? "neutral"} className={className}>
      {label}
    </Badge>
  );
}
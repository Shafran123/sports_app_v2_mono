import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@myslot/utils";
import { Card } from "./card";

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  className
}: {
  title: string;
  value: React.ReactNode;
  change?: number;
  changeLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-2">{title}</p>
          <p className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink">{value}</p>
        </div>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {(change !== undefined || changeLabel) && (
        <p className="mt-2 flex items-center gap-1 text-xs text-ink-2">
          {change !== undefined &&
            (positive ? (
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-error" />
            ))}
          <span className={change !== undefined ? (positive ? "font-semibold text-success" : "font-semibold text-error") : ""}>
            {change !== undefined ? `${positive ? "+" : ""}${change}%` : ""}
          </span>
          {changeLabel && <span className="text-ink-3">vs {changeLabel}</span>}
        </p>
      )}
    </Card>
  );
}
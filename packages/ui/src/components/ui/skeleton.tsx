import * as React from "react";
import { cn } from "@spots/utils";
import { Card } from "./card";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden="true" {...props} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-3 h-3 w-1/3" />
    </Card>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 rounded-3xl border border-border bg-surface p-4", className)}>
      <Skeleton className="h-14 w-14 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
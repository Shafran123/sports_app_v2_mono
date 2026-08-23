"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@myslot/utils";

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <DropdownPrimitive.Root>{children}</DropdownPrimitive.Root>;
}

export function DropdownTrigger({ children, asChild = true }: { children: React.ReactNode; asChild?: boolean }) {
  return <DropdownPrimitive.Trigger asChild={asChild}>{children}</DropdownPrimitive.Trigger>;
}

export function DropdownContent({ className, align = "end", children }: { className?: string; align?: "start" | "end" | "center"; children: React.ReactNode }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          "animate-pop-in z-50 min-w-40 rounded-2xl border border-border bg-surface p-1.5 shadow-lift",
          className
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({ className, children, onSelect, destructive }: { className?: string; children: React.ReactNode; onSelect?: (e: Event) => void; destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors",
        destructive ? "text-error hover:bg-error-light" : "text-ink hover:bg-surface-2",
        className
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <DropdownPrimitive.Label className={cn("px-3 py-1.5 text-xs font-medium text-ink-3", className)}>
      {children}
    </DropdownPrimitive.Label>
  );
}
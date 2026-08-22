"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@spots/utils";

export function Tabs({ defaultValue, value, onValueChange, children }: { defaultValue?: string; value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue} value={value} onValueChange={onValueChange}>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 rounded-full bg-surface-2 p-1", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors",
        "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-soft",
        "focus-visible:outline-2 focus-visible:outline-primary",
        className
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className={cn("mt-4", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
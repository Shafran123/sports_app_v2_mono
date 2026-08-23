"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@myslot/utils";

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogTrigger({ children, asChild = true }: { children: React.ReactNode; asChild?: boolean }) {
  return <DialogPrimitive.Trigger asChild={asChild}>{children}</DialogPrimitive.Trigger>;
}

export function DialogContent({
  children,
  className,
  title,
  description,
  onClose
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  onClose?: () => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="animate-fade-in fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "animate-pop-in fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-lift",
          "max-h-[85vh] overflow-y-auto focus:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {title && (
              <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-ink">
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm text-ink-2">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {(title || description) && (
            <DialogPrimitive.Close asChild>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          )}
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
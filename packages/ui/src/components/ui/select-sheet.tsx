"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@spots/utils";
import { Dialog, DialogContent } from "./dialog";
import { SHEET_CLASS } from "./sheet";

type OptionLike = React.ReactElement<{
  value: string;
  children?: React.ReactNode;
  disabled?: boolean;
}>;

function isOption(child: React.ReactNode): child is OptionLike {
  return React.isValidElement(child) && (child as React.ReactElement).type === "option";
}

// Dropdown that is a native <select> on md+ and a bottom sheet on touch
// screens. The mobile path replays the same synthetic change event shape as a
// native select, so existing `onChange={(e) => ... e.target.value}` handlers
// work unchanged.
export function SelectSheet({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  error,
  children
}: {
  id?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const options = React.Children.toArray(children).filter(isOption);
  const selected =
    value && value !== "" ? options.find((o) => o.props.value === value) : undefined;

  const fireChange = (next: string) => {
    onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <>
      <div className={cn("relative hidden md:block", className)}>
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "h-11 w-full appearance-none rounded-2xl border bg-surface px-4 pr-9 text-sm text-ink transition-colors",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            error ? "border-error focus:border-error" : "border-border",
            disabled && "opacity-50"
          )}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      </div>

      <button
        type="button"
        id={id ? `${id}-sheet` : undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-2xl border bg-surface px-4 text-sm transition-colors md:hidden",
          error ? "border-error" : "border-border",
          selected ? "text-ink" : "text-ink-3",
          disabled && "opacity-50",
          className
        )}
      >
        <span className="truncate">{selected ? selected.props.children : placeholder || "Select…"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={SHEET_CLASS}
          title={placeholder || "Select"}
          description="Choose an option"
          onClose={() => setOpen(false)}
        >
          <div className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto overscroll-contain">
            {options.map((opt) => (
              <button
                key={opt.props.value}
                type="button"
                disabled={opt.props.disabled}
                onClick={() => {
                  fireChange(opt.props.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors",
                  opt.props.value === value
                    ? "bg-primary-light text-primary"
                    : "text-ink hover:bg-surface-2"
                )}
              >
                <span>{opt.props.children}</span>
                {opt.props.value === value && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
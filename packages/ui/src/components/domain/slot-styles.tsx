"use client";

import * as React from "react";
import type { CourtAvailability, SlotState } from "@myslot/types";
import { cn } from "@myslot/utils";

export const SLOT_STATE_STYLES: Record<string, string> = {
  available:
    "border-border bg-surface text-ink hover:border-primary hover:bg-primary-light hover:text-primary",
  selected: "border-primary bg-primary text-white hover:bg-primary-hover",
  past: "border-border/60 bg-surface-2/50 text-ink-3 line-through cursor-not-allowed",
  outside_window: "border-border/60 bg-surface-2/40 text-ink-3/60 cursor-not-allowed",
  held: "border-warning/40 bg-warning-light/50 text-warning cursor-not-allowed",
  blocked: "border-border bg-surface-2 text-ink-3/70 cursor-not-allowed",
  booked: "border-border bg-error-light/50 text-error cursor-not-allowed"
};

export const SLOT_STATE_LABEL: Record<string, string> = {
  available: "Available",
  selected: "Selected",
  past: "Past",
  outside_window: "Outside window",
  held: "Held",
  blocked: "Blocked",
  booked: "Booked"
};

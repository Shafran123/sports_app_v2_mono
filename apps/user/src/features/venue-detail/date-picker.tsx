"use client";

import { Input } from "@myslot/ui";
import { addDaysKey, toDateKey } from "@myslot/utils";

// Date picker for the booking flow, labelled like the duration selector.
// Bounded by the venue's advance horizon: past dates are never selectable, and
// dates beyond the horizon (when advance_days > 0) are disabled. The server
// stays authoritative — a date beyond the horizon simply returns no
// availability.
export function DatePicker({
  selected,
  onSelect,
  advanceDays,
  disabled
}: {
  selected: string;
  onSelect: (key: string) => void;
  advanceDays?: number;
  disabled?: boolean;
}) {
  const today = toDateKey(new Date());
  const max = advanceDays === undefined || advanceDays <= 0 ? undefined : addDaysKey(today, advanceDays - 1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="date-select" className="text-xs font-medium text-ink-2">
        Date
      </label>
      <Input
        id="date-select"
        type="date"
        min={today}
        max={max}
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        aria-label="Pick a date"
        className="w-44"
      />
    </div>
  );
}
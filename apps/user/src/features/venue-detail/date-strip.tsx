"use client";

import { addDaysKey, cn, dayjs, toDateKey } from "@myslot/utils";

const DAY_COUNT = 14;

export function DateStrip({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  const todayKey = toDateKey(new Date());
  const days = Array.from({ length: DAY_COUNT }, (_, i) => addDaysKey(todayKey, i));

  return (
    <div
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
      role="tablist"
      aria-label="Pick a date"
    >
      {days.map((key) => {
        const d = dayjs(key, "YYYY-MM-DD");
        const isSelected = key === selected;
        const isPast = key < todayKey;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={isPast}
            onClick={() => onSelect(key)}
            className={cn(
              "press flex w-[4.5rem] shrink-0 flex-col items-center rounded-full border px-3 py-2 text-center transition-colors",
              isSelected
                ? "border-primary bg-primary text-white shadow-soft"
                : isPast
                  ? "cursor-not-allowed border-border/60 bg-surface-2/50 text-ink-3"
                  : "border-border bg-surface text-ink hover:border-primary/50 hover:bg-primary-light hover:text-primary"
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {key === todayKey ? "Today" : d.format("ddd")}
            </span>
            <span className="text-sm font-bold tabular-nums">{d.format("D MMM")}</span>
          </button>
        );
      })}
    </div>
  );
}
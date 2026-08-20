"use client";

import { addDaysKey, cn, dayjs, toDateKey } from "@spots/utils";

const DAY_COUNT = 7;

export function DateStrip({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  const todayKey = toDateKey(new Date());
  const days = Array.from({ length: DAY_COUNT }, (_, i) => addDaysKey(todayKey, i));

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pick a date">
      {days.map((key) => {
        const d = dayjs(key, "YYYY-MM-DD");
        const isSelected = key === selected;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(key)}
            className={cn(
              "press flex w-20 shrink-0 flex-col items-center rounded-2xl border px-3 py-2 text-center transition-colors",
              isSelected
                ? "border-primary bg-primary text-white shadow-soft"
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
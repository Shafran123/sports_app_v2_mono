"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { business, toApiFailure } from "@myslot/api";
import { Button, Card, Input } from "@myslot/ui";
import { cn, dayName } from "@myslot/utils";
import { Plus, Trash2, Copy } from "lucide-react";
import type { VenueHours } from "@myslot/types";

const DAYS = Array.from({ length: 7 }, (_, i) => i);

interface DayWindow {
  id: string;
  open_time: string;
  close_time: string;
}

type WindowsByDay = Record<number, DayWindow[]>;

let windowSeq = 0;
const newWindow = (open = "", close = ""): DayWindow => ({
  id: `w${windowSeq++}`,
  open_time: open,
  close_time: close
});

function fromHours(hours: VenueHours[]): WindowsByDay {
  const byDay: WindowsByDay = {};
  for (const h of hours) {
    const dow = Number(h.day_of_week);
    if (!byDay[dow]) byDay[dow] = [];
    byDay[dow].push(newWindow(h.open_time, h.close_time));
  }
  return byDay;
}

export function HoursEditor({
  venueId,
  hours,
  advanceDays,
  onSaved
}: {
  venueId: string;
  hours: VenueHours[];
  advanceDays: number | undefined;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [windows, setWindows] = useState<WindowsByDay>(() => fromHours(hours));
  const [daysAhead, setDaysAhead] = useState(advanceDays != null ? String(advanceDays) : "0");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const payload = DAYS.flatMap((dow) =>
        (windows[dow] ?? [])
          .filter((w) => Boolean(w.open_time) && Boolean(w.close_time))
          .map((w) => ({ day_of_week: dow, open_time: w.open_time, close_time: w.close_time }))
      );
      await business.updateVenueHours(venueId, payload);
      const days = Number(daysAhead);
      if (Number.isInteger(days) && days >= 0) {
        await business.updateAdvanceDays(venueId, days);
      }
    },
    onSuccess: () => {
      setNotice("Opening hours saved.");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["venue-detail", venueId] });
      void queryClient.invalidateQueries({ queryKey: ["my-venues"] });
      onSaved?.();
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
      setNotice("");
    }
  });

  const updateWindow = (dow: number, id: string, field: keyof DayWindow, value: string) => {
    setWindows((prev) => ({
      ...prev,
      [dow]: (prev[dow] ?? []).map((w) => (w.id === id ? { ...w, [field]: value } : w))
    }));
  };

  const addWindow = (dow: number) => {
    setWindows((prev) => ({ ...prev, [dow]: [...(prev[dow] ?? []), newWindow()] }));
  };

  const removeWindow = (dow: number, id: string) => {
    setWindows((prev) => ({ ...prev, [dow]: (prev[dow] ?? []).filter((w) => w.id !== id) }));
  };

  const copyDayToWeek = (sourceDow: number) => {
    const source = (windows[sourceDow] ?? []).map((w) => ({ ...w, id: newWindow().id }));
    setWindows((prev) => {
      const next = { ...prev };
      for (const dow of DAYS) {
        if (dow === sourceDow) continue;
        next[dow] = source.map((w) => ({ ...w }));
      }
      return next;
    });
  };

  const dayWindows = (dow: number) => windows[dow] ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Opening windows</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              A day can have several open→close windows (e.g. 09:00–12:00 and 14:00–23:00). Leave a day with no
              windows to close it.
            </p>
          </div>
          <Button type="button" onClick={() => save.mutate()} loading={save.isPending}>
            {save.isPending ? "Saving…" : "Save hours"}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {DAYS.map((dow) => {
            const entries = dayWindows(dow);
            return (
              <div key={dow} className="rounded-2xl bg-surface-2/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{dayName(dow)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyDayToWeek(dow)}
                      className="rounded-full px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface hover:text-primary"
                      title={`Copy ${dayName(dow)} to every day`}
                    >
                      <Copy className="mr-1 inline h-3.5 w-3.5" /> Copy to week
                    </button>
                    {entries.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => addWindow(dow)}
                        className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        + Add window
                      </button>
                    ) : null}
                  </div>
                </div>

                {entries.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-3">Closed</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {entries.map((w) => (
                      <div key={w.id} className="flex items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${dayName(dow)} window open time`}
                          value={w.open_time}
                          onChange={(e) => updateWindow(dow, w.id, "open_time", e.target.value)}
                          className="w-32"
                        />
                        <span className="text-ink-3">to</span>
                        <Input
                          type="time"
                          aria-label={`${dayName(dow)} window close time`}
                          value={w.close_time}
                          onChange={(e) => updateWindow(dow, w.id, "close_time", e.target.value)}
                          className="w-32"
                        />
                        <button
                          type="button"
                          onClick={() => removeWindow(dow, w.id)}
                          aria-label={`Remove ${dayName(dow)} window`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-error-light hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addWindow(dow)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      + Add window
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 rounded-lg bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
        {notice && <p className="mt-3 rounded-lg bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Advance booking horizon</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          How many days ahead players can book. 0 = no limit.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            aria-label="Advance days"
            value={daysAhead}
            onChange={(e) => setDaysAhead(e.target.value)}
            className="w-32"
          />
          <span className="text-sm text-ink-2">days</span>
        </div>
      </Card>
    </div>
  );
}
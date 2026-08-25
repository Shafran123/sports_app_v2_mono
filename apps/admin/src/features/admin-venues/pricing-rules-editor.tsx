"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, toApiFailure } from "@myslot/api";
import { Button, Card, EmptyState, Input, SelectSheet, Skeleton } from "@myslot/ui";
import { dayName, formatLkr } from "@myslot/utils";
import { Copy, Eraser, Paintbrush } from "lucide-react";
import type { CourtPricingRule, VenueHours } from "@myslot/types";
import {
  countDeadRules,
  flattenRulesToPaints,
  formatClock,
  paintsToRules,
  slotsForDay,
  type Paints
} from "./pricing-grid";

interface Court {
  id: string;
  name: string;
  price_per_slot: number;
  slot_duration_min: number;
}

// Monday-first week (backend dow: 0 = Sunday).
const DAYS = [1, 2, 3, 4, 5, 6, 0];

export function PricingRulesEditor({
  venueCourts,
  hours,
  onDirtyChange
}: {
  venueCourts: Court[];
  hours: VenueHours[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [courtId, setCourtId] = useState(venueCourts[0]?.id ?? "");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [priceInput, setPriceInput] = useState("");
  const [eraserActive, setEraserActive] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [paints, setPaints] = useState<Paints>({});
  const [deadRules, setDeadRules] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const court = venueCourts.find((c) => c.id === courtId) ?? venueCourts[0];
  const dur = court?.slot_duration_min || 60;
  const basePrice = court?.price_per_slot ?? 0;

  const query = useQuery({
    queryKey: ["court-pricing", courtId],
    queryFn: () => business.listPricingRules(courtId),
    enabled: Boolean(courtId)
  });
  const rules = query.data ?? [];

  const markDirty = () => {
    setDirty(true);
    onDirtyChange?.(true);
  };

  const markClean = () => {
    setDirty(false);
    onDirtyChange?.(false);
  };

  // Rebuild the painted grid whenever the loaded schedule or the venue's
  // opening hours change (a court switch, a save, or hours edited elsewhere).
  const loadedRef = useRef<{ key: string; paints: Paints; deadRules: number }>({ key: "", paints: {}, deadRules: 0 });
  const rulesKey = useMemo(
    () => JSON.stringify(rules.map((r: CourtPricingRule) => [r.day_of_week, r.start_time, r.end_time, r.price_per_slot])),
    [rules]
  );
  const hoursKey = useMemo(
    () => JSON.stringify(hours.map((h) => [h.day_of_week, h.open_time, h.close_time])),
    [hours]
  );
  const buildKey = useMemo(
    () => `${courtId}|${hoursKey}|${rulesKey}`,
    [courtId, hoursKey, rulesKey]
  );

  useEffect(() => {
    if (query.isLoading || query.isError) return;
    if (buildKey === loadedRef.current.key) return;
    const nextPaints = flattenRulesToPaints(rules, hours, basePrice, dur);
    const nextDead = countDeadRules(rules, hours, dur);
    loadedRef.current = { key: buildKey, paints: nextPaints, deadRules: nextDead };
    setPaints(nextPaints);
    setDeadRules(nextDead);
    markClean();
  }, [buildKey, rules, hours, basePrice, dur, hoursKey, query.isLoading, query.isError]);

  useEffect(() => {
    const stop = () => setIsPainting(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const applyToCell = (dow: number, start: string) => {
    if (eraserActive) {
      eraseCell(dow, start);
      return;
    }
    const price = Number(priceInput);
    if (priceInput === "" || !Number.isInteger(price) || price < 0) return;
    if (price === basePrice) {
      eraseCell(dow, start);
      return;
    }
    setPaints((prev) => ({ ...prev, [dow]: { ...prev[dow], [start]: price } }));
    markDirty();
  };

  const eraseCell = (dow: number, start: string) => {
    if (paints[dow]?.[start] === undefined) return;
    setPaints((prev) => {
      const day = prev[dow];
      if (!day) return prev;
      const nextDay = { ...day };
      delete nextDay[start];
      const next = { ...prev, [dow]: nextDay };
      if (Object.keys(nextDay).length === 0) delete next[dow];
      return next;
    });
    markDirty();
  };

  const copyDayToAll = () => {
    const source = { ...(paints[selectedDay] ?? {}) };
    setPaints((prev) => {
      const next = { ...prev, [selectedDay]: source };
      for (const d of DAYS) next[d] = { ...source };
      return next;
    });
    markDirty();
  };

  const discard = () => {
    setPaints(loadedRef.current.paints);
    setDeadRules(loadedRef.current.deadRules);
    markClean();
  };

  const save = useMutation({
    mutationFn: () => business.replacePricingRules(courtId, paintsToRules(paints, hours, dur)),
    onSuccess: () => {
      setNotice("Pricing saved.");
      setError("");
      markClean();
      void queryClient.invalidateQueries({ queryKey: ["court-pricing"] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
      setNotice("");
    }
  });

  const selectCourt = (id: string) => {
    if (id === courtId) return;
    if (dirty && !window.confirm("Discard unsaved pricing changes?")) return;
    setCourtId(id);
    setPaints({});
    setDirty(false);
    onDirtyChange?.(false);
  };

  const cells = slotsForDay(hours, selectedDay, dur);
  const dayPaints = paints[selectedDay] ?? {};
  const paintedCount = Object.keys(dayPaints).length;
  const previewRules = paintsToRules(paints, hours, dur);

  if (!court) return null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Variable pricing</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Paint a price onto slots for different day/ time windows (peak vs off-peak). Type a price, then tap or drag
              across slots. The eraser (or typing the base price) restores a slot to the court&apos;s base price of{" "}
              {formatLkr(basePrice)}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={discard} disabled={!dirty}>
              Discard
            </Button>
            <Button size="sm" loading={save.isPending} disabled={hours.length === 0} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save pricing"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SelectSheet value={courtId} onChange={(e) => selectCourt(e.target.value)} aria-label="Court" className="w-44">
            {venueCourts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectSheet>
          <Input
            type="number"
            min={0}
            aria-label="Price to paint"
            placeholder={`Price (Rs)`}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-32"
          />
          <Button
            variant={eraserActive ? "secondary" : "outline"}
            size="sm"
            onClick={() => setEraserActive((v) => !v)}
            aria-pressed={eraserActive}
            title="Toggle eraser"
          >
            {eraserActive ? <Eraser className="h-4 w-4" /> : <Paintbrush className="h-4 w-4" />}
            {eraserActive ? "Erasing" : "Paint"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copyDayToAll}
            disabled={paintedCount === 0}
            title={`Copy ${dayName(selectedDay)} paints to every day`}
          >
            <Copy className="h-4 w-4" /> Copy to week
          </Button>
        </div>

        {error && <p className="mt-3 rounded-lg bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
        {notice && <p className="mt-3 rounded-lg bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}
        {deadRules > 0 && (
          <p className="mt-3 rounded-lg bg-warning-light px-3 py-2 text-sm text-warning">
            {deadRules} saved pricing rule{deadRules > 1 ? "s" : ""} {deadRules > 1 ? "have" : "has"} no matching
            slot-times in the current opening hours and will be removed when you save.
          </p>
        )}
        {hours.length === 0 && (
          <p className="mt-3 rounded-lg bg-warning-light px-3 py-2 text-sm text-warning">
            This venue has no opening hours yet. Set them on the Hours tab first — the schedule below is built from
            them.
          </p>
        )}

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {court.name} · {dur}-min slots · base {formatLkr(basePrice)}
            </p>
            <p className="text-xs text-ink-3">
              {paintedCount} of {cells.length} slot{ cells.length === 1 ? "" : "s"} priced
            </p>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  d === selectedDay
                    ? "bg-primary text-white shadow-soft"
                    : "bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink"
                }`}
              >
                {dayName(d)}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {hours.length === 0 ? (
              <EmptyState title="No opening hours" message="Add opening hours on the Hours tab to build the slot grid." />
            ) : cells.length === 0 ? (
              <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-sm text-ink-3">
                {dayName(selectedDay)} is closed — no slots to price.
              </p>
            ) : (
              <div className="grid select-none grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {cells.map((start) => {
                  const price = dayPaints[start];
                  const painted = price !== undefined;
                  return (
                    <button
                      key={start}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setIsPainting(true);
                        applyToCell(selectedDay, start);
                      }}
                      onPointerEnter={() => {
                        if (isPainting) applyToCell(selectedDay, start);
                      }}
                      aria-label={`${dayName(selectedDay)} ${formatClock(start)} ${
                        painted ? formatLkr(price) : `base ${formatLkr(basePrice)}`
                      }`}
                      className={`flex touch-none flex-col items-center rounded-xl border px-1 py-2 transition-colors ${
                        painted
                          ? "border-primary bg-primary text-white shadow-sm"
                          : eraserActive
                            ? "border-dashed border-error/50 bg-error-light/40 text-ink"
                            : "border-border bg-surface-2/60 text-ink hover:border-primary/50"
                      }`}
                    >
                      <span className="text-[11px] font-semibold">{formatClock(start)}</span>
                      <span className={`text-[11px] ${painted ? "text-white/90" : "text-ink-2"}`}>
                        {formatLkr(painted ? price : basePrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold tracking-tight text-ink">What will be saved</h3>
        <div className="mt-3">
          {query.isLoading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : query.isError ? (
            <p className="text-sm text-error">Could not load pricing rules.</p>
          ) : paintedCount === 0 ? (
            <EmptyState title="No variable pricing" message="This court uses its base price for every slot." />
          ) : (
            <ul className="space-y-2">
              {previewRules.map((r, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
                >
                  <p className="min-w-0 text-sm font-medium text-ink">
                    {dayName(r.day_of_week as number)} · {formatClock(r.start_time)} – {formatClock(r.end_time)}
                  </p>
                  <p className="shrink-0 text-xs text-ink-2">{formatLkr(r.price_per_slot)} / slot</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
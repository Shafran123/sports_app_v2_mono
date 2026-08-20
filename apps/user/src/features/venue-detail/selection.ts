import type { Availability, CourtAvailability, Slot } from "@spots/types";

export const MAX_SLOTS = 8;

export type SelectedSlots = Record<string, { start: string; end: string }>;

export function selectionKey(courtId: string, startAt: string): string {
  return `${courtId}:${startAt}`;
}

/**
 * Toggle a slot into/out of the selection.
 *
 * Invariants: selection lives on ONE court only, as ONE contiguous run of at
 * most MAX_SLOTS slots. Clicking a selected slot clears that court's run;
 * clicking an available slot on another court replaces the whole selection;
 * clicking a slot further along the same court extends the run and fills the
 * gap, but never jumps over a taken (held/booked/blocked/past) slot.
 */
export function toggleSlot(selected: SelectedSlots, court: CourtAvailability, slot: Slot): SelectedSlots {
  const prefix = `${court.court_id}:`;
  const key = selectionKey(court.court_id, slot.start_at);

  if (selected[key]) {
    const next: SelectedSlots = {};
    for (const [k, v] of Object.entries(selected)) {
      if (!k.startsWith(prefix)) next[k] = v;
    }
    return next;
  }

  const onThisCourt = Object.keys(selected).filter((k) => k.startsWith(prefix));
  if (onThisCourt.length === 0 || onThisCourt.length !== Object.keys(selected).length) {
    return { [key]: { start: slot.start_at, end: slot.end_at } };
  }

  const selectedIdx: number[] = [];
  court.slots.forEach((s, i) => {
    if (selected[selectionKey(court.court_id, s.start_at)]) selectedIdx.push(i);
  });
  const clickedIdx = court.slots.findIndex((s) => s.start_at === slot.start_at);
  if (clickedIdx < 0 || selectedIdx.length === 0) return selected;

  const lo = Math.min(clickedIdx, selectedIdx[0] ?? clickedIdx);
  const hi = Math.max(clickedIdx, selectedIdx[selectedIdx.length - 1] ?? clickedIdx);
  const run = court.slots.slice(lo, hi + 1);
  const jumpsOverTaken = run.some(
    (s) => s.state !== "available" && !selected[selectionKey(court.court_id, s.start_at)]
  );
  if (jumpsOverTaken || run.length > MAX_SLOTS) return selected;

  const next: SelectedSlots = {};
  for (const s of run) {
    next[selectionKey(court.court_id, s.start_at)] = { start: s.start_at, end: s.end_at };
  }
  return next;
}

export interface SelectionSummary {
  count: number;
  courtId: string | null;
  courtName: string | null;
  total: number;
  startAt: string | null;
  endAt: string | null;
}

const EMPTY_SUMMARY: SelectionSummary = {
  count: 0,
  courtId: null,
  courtName: null,
  total: 0,
  startAt: null,
  endAt: null
};

export function summarizeSelection(selected: SelectedSlots, availability?: Availability): SelectionSummary {
  const entries = Object.entries(selected);
  if (entries.length === 0 || !availability) return EMPTY_SUMMARY;

  const first = entries[0];
  const courtId = first?.[0]?.split(":")[0];
  const court = courtId ? availability.courts.find((c) => c.court_id === courtId) : undefined;
  if (!courtId || !court) return EMPTY_SUMMARY;

  const sorted = entries.map(([, v]) => v).sort((a, b) => a.start.localeCompare(b.start));
  const startAt = sorted[0]?.start ?? null;
  const last = sorted[sorted.length - 1];
  const endAt = last?.end ?? null;
  const count = sorted.length;

  return {
    count,
    courtId,
    courtName: court.name,
    total: count * court.price_per_slot,
    startAt,
    endAt
  };
}

/** Contract with /book/[venueId]: date, court_id, start_at, end_at (ISO strings). */
export function buildCtaHref(venueId: string, date: string, summary: SelectionSummary): string {
  if (summary.count === 0 || !summary.courtId || !summary.startAt || !summary.endAt) return "";
  const params = new URLSearchParams({
    date,
    court_id: summary.courtId,
    start_at: summary.startAt,
    end_at: summary.endAt
  });
  return `/book/${venueId}?${params.toString()}`;
}
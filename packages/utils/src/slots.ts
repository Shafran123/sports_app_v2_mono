import type { Availability, CourtAvailability, Slot } from "@myslot/types";

// Pure availability run-selection helpers shared by every booking surface
// (the venue page, the booking widget and the owner's front-desk quick book)
// so the "pick a duration, then a contiguous run of slots" behaviour is one
// implementation everywhere.

export const MAX_SLOTS = 8;

export type SelectedSlots = Record<string, { start: string; end: string }>;

export function selectionKey(courtId: string, startAt: string): string {
  return `${courtId}:${startAt}`;
}

// Duration chips offered for a court on a date: multiples of the court's slot
// duration, capped at MAX_SLOTS and at the longest contiguous run of available
// slots in a single Opening Window. Returns durations in minutes, ascending.
export function durationChoices(court: CourtAvailability, slots: Slot[]): number[] {
  const dur = court.slot_duration_min;
  const maxRun = longestAvailableRun(slots);
  const count = Math.max(1, Math.min(MAX_SLOTS, maxRun));
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(i * dur);
  return out;
}

// Longest run of consecutive available slots that are contiguous in time — a
// run can never cross a gap between Opening Windows (a new window's first slot
// does not start at the previous window's last end).
export function longestAvailableRun(slots: Slot[]): number {
  let best = 0;
  let cur = 0;
  let prevEnd: string | null = null;
  for (const slot of slots) {
    const contiguous = slot.state === "available" && prevEnd !== null && slot.start_at === prevEnd;
    if (slot.state === "available" && (cur === 0 || contiguous)) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = slot.state === "available" ? 1 : 0;
    }
    prevEnd = slot.end_at;
  }
  return best;
}

// Select a run of `durationMin` starting at `slot`. Returns the updated
// selection (always on ONE court, contiguous, never spanning a gap/taken slot).
export function selectRun(
  selected: SelectedSlots,
  court: CourtAvailability,
  startSlot: Slot,
  durationMin: number
): SelectedSlots {
  const dur = durationMin / court.slot_duration_min;
  const idx = court.slots.findIndex((s) => s.start_at === startSlot.start_at);
  if (idx < 0 || dur < 1) return selected;

  const run: Slot[] = [];
  let prevEnd: string | null = null;
  for (let i = idx; i < court.slots.length && run.length < dur; i++) {
    const s = court.slots[i]!;
    const isSel = isSelected(selected, court, s);
    const passable = s.state === "available" || isSel;
    if (prevEnd === null) {
      if (!passable) return selected;
    } else {
      if (s.start_at !== prevEnd) return selected; // gap between windows
      if (!passable) return selected;
    }
    run.push(s);
    prevEnd = s.end_at;
  }
  if (run.length < dur) return selected;

  const next: SelectedSlots = {};
  for (const s of run) {
    next[selectionKey(court.court_id, s.start_at)] = { start: s.start_at, end: s.end_at };
  }
  return next;
}

function isSelected(selected: SelectedSlots, court: CourtAvailability, slot: Slot): boolean {
  return !!selected[selectionKey(court.court_id, slot.start_at)];
}

export interface SelectionSummary {
  count: number;
  durationMin: number;
  courtId: string | null;
  courtName: string | null;
  total: number;
  baseTotal: number;
  startAt: string | null;
  endAt: string | null;
}

const EMPTY_SUMMARY: SelectionSummary = {
  count: 0,
  durationMin: 0,
  courtId: null,
  courtName: null,
  total: 0,
  baseTotal: 0,
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
  const durationMin = count * court.slot_duration_min;

  let total = 0;
  let baseTotal = 0;
  const byStart = new Map<string, Slot>(court.slots.map((s) => [s.start_at, s]));
  for (const [, v] of entries) {
    const slot = byStart.get(v.start);
    const base = slot?.price ?? court.price_per_slot;
    baseTotal += base;
    total += slot?.offer_price ?? base;
  }

  return {
    count,
    durationMin,
    courtId,
    courtName: court.name,
    total,
    baseTotal,
    startAt,
    endAt
  };
}

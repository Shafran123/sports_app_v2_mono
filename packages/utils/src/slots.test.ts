import { describe, expect, it } from "vitest";
import type { CourtAvailability } from "@myslot/types";
import { durationChoices, selectRun, summarizeSelection, type SelectedSlots } from "./slots";

const court: CourtAvailability = {
  court_id: "court-1",
  name: "Court 1",
  sport: "Badminton",
  price_per_slot: 1500,
  slot_duration_min: 60,
  slots: [
    { start_at: "2026-08-22T04:30:00.000Z", end_at: "2026-08-22T05:30:00.000Z", state: "available" },
    { start_at: "2026-08-22T05:30:00.000Z", end_at: "2026-08-22T06:30:00.000Z", state: "available" }
  ]
};

const availability = { date: "2026-08-22", courts: [court] };

function selectSlots(keys: string[]): SelectedSlots {
  const out: SelectedSlots = {};
  for (const k of keys) {
    const slot = court.slots.find((s) => s.start_at === k)!;
    out[`${court.court_id}:${k}`] = { start: slot.start_at, end: slot.end_at };
  }
  return out;
}

describe("selectRun", () => {
  it("selects a run of the chosen duration from the clicked slot", () => {
    const next = selectRun({}, court, court.slots[0]!, 120);
    expect(Object.keys(next)).toHaveLength(2);
  });

  it("refuses to run past a gap or a taken slot", () => {
    const gapped: CourtAvailability = {
      ...court,
      slots: [
        { start_at: "2026-08-22T04:30:00.000Z", end_at: "2026-08-22T05:30:00.000Z", state: "available" },
        { start_at: "2026-08-23T04:30:00.000Z", end_at: "2026-08-23T05:30:00.000Z", state: "available" }
      ]
    };
    const next = selectRun({}, gapped, gapped.slots[0]!, 120);
    expect(next).toEqual({});
  });

  it("moves the run when clicking a slot on another court", () => {
    const other: CourtAvailability = { ...court, court_id: "court-2", slots: [court.slots[0]!] };
    const sel = selectRun({}, court, court.slots[0]!, 60);
    const moved = selectRun(sel, other, other.slots[0]!, 60);
    expect(Object.keys(moved)).toHaveLength(1);
    expect(moved[`${other.court_id}:${other.slots[0]!.start_at}`]).toBeDefined();
    expect(moved[`${court.court_id}:${court.slots[0]!.start_at}`]).toBeUndefined();
  });
});

describe("durationChoices", () => {
  it("offers multiples of the slot duration capped by the longest run", () => {
    expect(durationChoices(court, court.slots)).toEqual([60, 120]);
  });
});

describe("summarizeSelection", () => {
  it("returns an empty summary with no selection", () => {
    expect(summarizeSelection({})).toEqual({
      count: 0,
      durationMin: 0,
      courtId: null,
      courtName: null,
      total: 0,
      baseTotal: 0,
      startAt: null,
      endAt: null
    });
  });

  it("sums offer price and reports the contiguous range", () => {
    const offered: CourtAvailability = {
      ...court,
      slots: [
        { start_at: "2026-08-22T04:30:00.000Z", end_at: "2026-08-22T05:30:00.000Z", state: "available", price: 1500, offer_price: 1200 },
        { start_at: "2026-08-22T05:30:00.000Z", end_at: "2026-08-22T06:30:00.000Z", state: "available", price: 1500, offer_price: 1200 }
      ]
    };
    const offeredAvailability = { date: "2026-08-22", courts: [offered] };
    const summary = summarizeSelection(selectSlots(offered.slots.map((s) => s.start_at)), offeredAvailability);
    expect(summary.total).toBe(2400);
    expect(summary.baseTotal).toBe(3000);
    expect(summary.count).toBe(2);
    expect(summary.durationMin).toBe(120);
    expect(summary.startAt).toBe(offered.slots[0]!.start_at);
    expect(summary.endAt).toBe(offered.slots[1]!.end_at);
  });
});

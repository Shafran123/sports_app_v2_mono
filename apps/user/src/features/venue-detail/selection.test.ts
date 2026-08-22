import { describe, expect, it } from "vitest";
import type { CourtAvailability } from "@spots/types";
import { buildCtaHref, summarizeSelection, toggleSlot, type SelectedSlots } from "./selection";

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

describe("toggleSlot", () => {
  it("adds a single slot", () => {
    const next = toggleSlot({}, court, court.slots[0]!);
    expect(Object.keys(next)).toHaveLength(1);
  });

  it("clears the run when re-toggling a selected slot", () => {
    const sel = selectSlots([court.slots[0]!.start_at]);
    const next = toggleSlot(sel, court, court.slots[0]!);
    expect(next).toEqual({});
  });
});

describe("buildCtaHref", () => {
  it("returns empty string with no selection", () => {
    expect(buildCtaHref({ venueId: "v1", venueName: "Smash Arena", venueSlug: "smash", date: "2026-08-22" }, summarizeSelection({}, availability))).toBe("");
  });

  it("carries venue + court display names and price into checkout", () => {
    const summary = summarizeSelection(selectSlots([court.slots[0]!.start_at]), availability);
    const href = buildCtaHref({ venueId: "v1", venueName: "Smash Arena", venueSlug: "smash", date: "2026-08-22" }, summary);
    const params = new URLSearchParams(href.split("?")[1]);

    expect(href).toMatch(/^\/book\/v1\?/);
    expect(params.get("venue")).toBe("Smash Arena");
    expect(params.get("venue_slug")).toBe("smash");
    expect(params.get("court")).toBe("Court 1");
    expect(params.get("court_id")).toBe("court-1");
    expect(params.get("price_per_slot")).toBe("1500");
    expect(params.get("slots")).toBe("1");
    expect(params.get("start_at")).toBe(court.slots[0]!.start_at);
    expect(params.get("end_at")).toBe(court.slots[0]!.end_at);
  });

  it("counts multi-slot selections", () => {
    const summary = summarizeSelection(selectSlots(court.slots.map((s) => s.start_at)), availability);
    const href = buildCtaHref({ venueId: "v1", venueName: "Smash Arena", venueSlug: "smash", date: "2026-08-22" }, summary);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("slots")).toBe("2");
    expect(params.get("price_per_slot")).toBe("1500");
  });
});
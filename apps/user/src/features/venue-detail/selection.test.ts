import { describe, expect, it } from "vitest";
import type { CourtAvailability } from "@myslot/types";
import { applyVenueOffer, buildCtaHref, durationChoices, selectRun, summarizeSelection, type SelectedSlots } from "./selection";

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

describe("applyVenueOffer", () => {
  it("applies a percentage offer off the amount", () => {
    expect(applyVenueOffer(1500, { discount_type: "percent", value: 20 })).toEqual({ total: 1200, discount: 300 });
  });

  it("applies a flat offer, capped at the amount", () => {
    expect(applyVenueOffer(1500, { discount_type: "flat", value: 500 })).toEqual({ total: 1000, discount: 500 });
    expect(applyVenueOffer(300, { discount_type: "flat", value: 500 })).toEqual({ total: 0, discount: 300 });
  });

  it("returns the amount unchanged without an offer", () => {
    expect(applyVenueOffer(1500, null)).toEqual({ total: 1500, discount: 0 });
    expect(applyVenueOffer(1500, undefined)).toEqual({ total: 1500, discount: 0 });
  });
});

describe("summarizeSelection with offers", () => {
  const offeredCourt: CourtAvailability = {
    ...court,
    slots: [
      { start_at: "2026-08-22T04:30:00.000Z", end_at: "2026-08-22T05:30:00.000Z", state: "available", price: 1500, offer_price: 1200 }
    ]
  };
  const offeredAvailability = { date: "2026-08-22", courts: [offeredCourt] };
  const select = (): SelectedSlots => ({
    [`${offeredCourt.court_id}:${offeredCourt.slots[0]!.start_at}`]: {
      start: offeredCourt.slots[0]!.start_at,
      end: offeredCourt.slots[0]!.end_at
    }
  });

  it("totals the offer price when a slot is discounted", () => {
    const summary = summarizeSelection(select(), offeredAvailability);
    expect(summary.total).toBe(1200);
    expect(summary.baseTotal).toBe(1500);
  });

  it("carries the discounted price into the checkout link and keeps the base", () => {
    const summary = summarizeSelection(select(), offeredAvailability);
    const href = buildCtaHref({ venueId: "v1", venueName: "Smash Arena", venueSlug: "smash", date: "2026-08-22" }, summary);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("price_per_slot")).toBe("1200");
    expect(params.get("base_price_per_slot")).toBe("1500");
  });
});
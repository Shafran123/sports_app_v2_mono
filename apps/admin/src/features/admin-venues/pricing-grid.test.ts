import { describe, expect, it } from "vitest";
import type { CourtPricingRule, VenueHours } from "@myslot/types";
import {
  countDeadRules,
  flattenRulesToPaints,
  formatClock,
  fromMin,
  paintsToRules,
  slotsForDay,
  toMinutes
} from "./pricing-grid";

const ALL_DAYS: VenueHours[] = Array.from({ length: 7 }, (_, d) => ({
  day_of_week: d,
  open_time: "06:00",
  close_time: "23:00"
}));

const rule = (patch: Partial<CourtPricingRule> = {}): CourtPricingRule => ({
  id: "r1",
  day_of_week: null,
  start_time: "18:00",
  end_time: "21:00",
  price_per_slot: 2000,
  ...patch
});

describe("time helpers", () => {
  it("converts HH:MM to minutes and back", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("18:30")).toBe(1110);
    expect(fromMin(1110)).toBe("18:30");
    expect(fromMin(1440)).toBe("24:00");
  });

  it("formats clocks in 12-hour form", () => {
    expect(formatClock("06:00")).toBe("6:00 AM");
    expect(formatClock("18:30")).toBe("6:30 PM");
    expect(formatClock("00:00")).toBe("12:00 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
  });
});

describe("slotsForDay", () => {
  it("steps each slot by the duration inside a window", () => {
    const starts = slotsForDay(ALL_DAYS, 0, 60);
    expect(starts[0]).toBe("06:00");
    expect(starts).toHaveLength(17);
    expect(starts[starts.length - 1]).toBe("22:00");
  });

  it("steps by a non-hour duration", () => {
    const hours: VenueHours[] = [{ day_of_week: 0, open_time: "09:00", close_time: "12:00" }];
    expect(slotsForDay(hours, 0, 45)).toEqual(["09:00", "09:45", "10:30", "11:15"]);
  });

  it("derives each day from its own windows and never crosses a gap", () => {
    const hours: VenueHours[] = [{ day_of_week: 0, open_time: "09:00", close_time: "12:00" }];
    expect(slotsForDay(hours, 0, 60)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("returns no slots for a closed day", () => {
    expect(slotsForDay([], 3, 60)).toEqual([]);
  });
});

describe("flattenRulesToPaints", () => {
  it("paints slot-times a rule covers, leaving base-price times unpainted", () => {
    const paints = flattenRulesToPaints([rule({ day_of_week: 1 })], ALL_DAYS, 1500, 60);
    expect(paints[1]).toEqual({ "18:00": 2000, "19:00": 2000, "20:00": 2000 });
    expect(paints[2]).toBeUndefined();
  });

  it("day-specific rules win over day-agnostic ones (most-specific-wins)", () => {
    const paints = flattenRulesToPaints(
      [
        rule({ id: "a", day_of_week: null, start_time: "06:00", end_time: "23:00", price_per_slot: 1600 }),
        rule({ id: "b", day_of_week: 1, start_time: "18:00", end_time: "21:00", price_per_slot: 2000 })
      ],
      ALL_DAYS,
      1500,
      60
    );
    expect(paints[1]?.["18:00"]).toBe(2000);
    expect(paints[2]?.["18:00"]).toBe(1600);
  });

  it("treats a rule pricing at the base price as unpainted", () => {
    const paints = flattenRulesToPaints([rule({ price_per_slot: 1500 })], ALL_DAYS, 1500, 60);
    expect(paints[1]).toBeUndefined();
  });
});

describe("countDeadRules", () => {
  it("counts rules whose window covers no scheduled slot-time", () => {
    expect(countDeadRules([rule()], ALL_DAYS, 60)).toBe(0);
    expect(countDeadRules([rule({ start_time: "02:00", end_time: "03:00" })], ALL_DAYS, 60)).toBe(1);
  });
});

describe("paintsToRules", () => {
  it("coalesces contiguous same-price cells into one window per run", () => {
    const paints = { 1: { "18:00": 2000, "19:00": 2000, "20:00": 2000, "06:00": 1500 } };
    const rules = paintsToRules(paints, ALL_DAYS, 60);
    expect(rules).toEqual([
      { day_of_week: 1, start_time: "06:00", end_time: "07:00", price_per_slot: 1500 },
      { day_of_week: 1, start_time: "18:00", end_time: "21:00", price_per_slot: 2000 }
    ]);
  });

  it("splits runs when the price changes or cells are not adjacent", () => {
    const paints = {
      5: { "09:00": 1800, "10:00": 1800, "14:00": 2000, "15:00": 2000, "18:00": 1500 }
    };
    const rules = paintsToRules(paints, ALL_DAYS, 60);
    expect(rules).toEqual([
      { day_of_week: 5, start_time: "09:00", end_time: "11:00", price_per_slot: 1800 },
      { day_of_week: 5, start_time: "14:00", end_time: "16:00", price_per_slot: 2000 },
      { day_of_week: 5, start_time: "18:00", end_time: "19:00", price_per_slot: 1500 }
    ]);
  });

  it("round-trips a painted grid back to the same prices", () => {
    const paints = flattenRulesToPaints([rule({ day_of_week: 1 })], ALL_DAYS, 1500, 60);
    const rules = paintsToRules(paints, ALL_DAYS, 60);
    expect(rules).toEqual([{ day_of_week: 1, start_time: "18:00", end_time: "21:00", price_per_slot: 2000 }]);
  });

  it("derives end times that fit inside the opening window", () => {
    const paints = { 0: { "22:00": 2500 } };
    const rules = paintsToRules(paints, ALL_DAYS, 60);
    expect(rules[0].end_time).toBe("23:00");
  });

  it("uses fromMin for window ends", () => {
    expect(fromMin(toMinutes("18:00") + 60)).toBe("19:00");
  });
});
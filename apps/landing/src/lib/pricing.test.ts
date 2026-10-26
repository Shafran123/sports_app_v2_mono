import { describe, expect, it } from "vitest";
import { PLAN, defaultCurrency, formatPrice, perMonth, periodTotal } from "./pricing";

describe("plan pricing", () => {
  it("monthly is the list price", () => {
    expect(periodTotal("USD", "monthly")).toBe(20);
    expect(periodTotal("LKR", "monthly")).toBe(PLAN.lkrMonthly);
  });

  it("annual is 12 months less 20%", () => {
    expect(periodTotal("USD", "annual")).toBe(192);
    expect(periodTotal("LKR", "annual")).toBe(PLAN.lkrMonthly * 12 * 0.8);
    expect(perMonth("USD", "annual")).toBe(16);
  });

  it("shows LKR only to visitors in Sri Lanka", () => {
    expect(defaultCurrency("LK")).toBe("LKR");
    expect(defaultCurrency("lk")).toBe("LKR");
    expect(defaultCurrency("US")).toBe("USD");
    expect(defaultCurrency(null)).toBe("USD");
  });

  it("formats with thousands separators", () => {
    expect(formatPrice("LKR", 57600)).toBe("LKR 57,600");
  });
});

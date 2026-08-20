import { describe, expect, it } from "vitest";
import { formatLkr } from "./format";

describe("formatLkr", () => {
  it("formats a whole number with en-LK grouping and Rs prefix", () => {
    expect(formatLkr(1250)).toBe("Rs 1,250");
  });

  it("formats a decimal to two places", () => {
    expect(formatLkr(120.5)).toBe("Rs 120.50");
  });

  it("formats a string number input", () => {
    expect(formatLkr("4500" as unknown as number)).toBe("Rs 4,500");
  });

  it("returns an em-dash placeholder for null/undefined/NaN", () => {
    expect(formatLkr(null)).toBe("Rs \u2014");
    expect(formatLkr(undefined)).toBe("Rs \u2014");
    expect(formatLkr(Number.NaN)).toBe("Rs \u2014");
  });

  it("groups large values with commas (en-LK style)", () => {
    expect(formatLkr(1234567)).toBe("Rs 1,234,567");
  });
});
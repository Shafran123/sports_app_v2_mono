import { describe, expect, it } from "vitest";
import { formatDuration, formatLkr, humanizeSlug } from "./format";

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

describe("humanizeSlug", () => {
  it("title-cases a snake_case slug", () => {
    expect(humanizeSlug("changing_rooms")).toBe("Changing Rooms");
    expect(humanizeSlug("equipment_rental")).toBe("Equipment Rental");
  });

  it("handles kebab-case and single words", () => {
    expect(humanizeSlug("parking")).toBe("Parking");
    expect(humanizeSlug("indoor-court")).toBe("Indoor Court");
  });

  it("keeps common acronyms uppercase", () => {
    expect(humanizeSlug("ac")).toBe("AC");
  });
});

describe("formatDuration", () => {
  it("renders minutes, hours, and mixed", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(30)).toBe("30m");
  });

  it("returns an empty string for null/undefined/zero", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(0)).toBe("");
  });
});
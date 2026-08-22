import { describe, expect, it } from "vitest";
import { dayName, formatTime12, formatDateLong, toDateKey, addDaysKey, dayLabel } from "./dates";

describe("dayName", () => {
  it("maps 0-6 to English day names", () => {
    expect(dayName(0)).toBe("Sunday");
    expect(dayName(5)).toBe("Friday");
    expect(dayName(6)).toBe("Saturday");
  });

  it("falls back to Unknown for out-of-range", () => {
    expect(dayName(9)).toBe("Unknown");
    expect(dayName(-1)).toBe("Unknown");
  });
});

describe("formatTime12", () => {
  it("renders 12-hour time with AM/PM", () => {
    expect(formatTime12("2026-08-20T18:30:00Z", "UTC")).toBe("6:30 PM");
    expect(formatTime12("2026-08-20T08:05:00Z", "UTC")).toBe("8:05 AM");
  });

  it("handles midnight and noon", () => {
    expect(formatTime12("2026-08-20T00:00:00Z", "UTC")).toBe("12:00 AM");
    expect(formatTime12("2026-08-20T12:00:00Z", "UTC")).toBe("12:00 PM");
  });
});

describe("formatDateLong", () => {
  it("renders a full date", () => {
    expect(formatDateLong("2026-08-20T00:00:00Z", "UTC")).toBe("Thursday, 20 August 2026");
  });
});

describe("toDateKey", () => {
  it("produces a local YYYY-MM-DD key", () => {
    const d = new Date(2026, 7, 20, 10, 30); // Aug 20 local
    expect(toDateKey(d)).toBe("2026-08-20");
  });
});

describe("addDaysKey", () => {
  it("adds days to a date key", () => {
    expect(addDaysKey("2026-08-20", 1)).toBe("2026-08-21");
    expect(addDaysKey("2026-08-20", -2)).toBe("2026-08-18");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("dayLabel", () => {
  const today = toDateKey(new Date());
  const at = (key: string) => `${key}T10:00:00`;

  it("labels today and tomorrow explicitly", () => {
    expect(dayLabel(at(today))).toBe("Today");
    expect(dayLabel(at(addDaysKey(today, 1)))).toBe("Tomorrow");
  });

  it("falls back to a short weekday+date for other days", () => {
    expect(dayLabel(at(addDaysKey(today, 3)))).toMatch(/^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2}$/);
  });
});
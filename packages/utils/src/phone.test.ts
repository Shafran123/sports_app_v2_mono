import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("strips spaces, dashes, parens and dots", () => {
    expect(normalizePhone("+94 71 234 5678")).toBe("+94712345678");
    expect(normalizePhone("+1 (650) 555-3434")).toBe("+16505553434");
    expect(normalizePhone("+94.71.234.5678")).toBe("+94712345678");
  });

  it("requires a leading + (country code)", () => {
    expect(normalizePhone("071 234 5678")).toBeNull();
    expect(normalizePhone("94712345678")).toBeNull();
  });

  it("rejects missing or empty input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone(null as unknown as string)).toBeNull();
  });

  it("rejects numbers outside E.164 length (7–15 digits)", () => {
    expect(normalizePhone("+94 123")).toBeNull();
    expect(normalizePhone("+94 712 345 678 901 23")).toBeNull();
  });

  it("rejects letters", () => {
    expect(normalizePhone("+94 7abc 5678")).toBeNull();
  });

  it("accepts a bare canonical E.164 number", () => {
    expect(normalizePhone("+94712345678")).toBe("+94712345678");
  });
});
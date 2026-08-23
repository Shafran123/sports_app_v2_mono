import { describe, expect, it } from "vitest";
import { getScreenshot, resolveScreenshot, screenshots } from "./screenshots";

describe("screenshot config", () => {
  it("declares one screenshot per feature section", () => {
    expect(screenshots).toHaveLength(6);
  });

  it("every entry carries an id, label, and frame kind", () => {
    for (const shot of screenshots) {
      expect(shot.id).toBeTruthy();
      expect(shot.label).toBeTruthy();
      expect(["phone", "browser"]).toContain(shot.frame);
    }
  });

  it("placeholder entries have no src yet, so they resolve to null (render the mock)", () => {
    for (const shot of screenshots) {
      expect(resolveScreenshot(shot)).toBeNull();
    }
  });

  it("an entry with a src resolves to the image URL (the one-line swap)", () => {
    const withSrc = { id: "x", label: "X", frame: "phone", src: "/shots/real.png" } as const;
    expect(resolveScreenshot(withSrc)).toBe("/shots/real.png");
  });

  it("looks up a screenshot by id and returns undefined for unknown ids", () => {
    expect(getScreenshot("payments")?.id).toBe("payments");
    expect(getScreenshot("does-not-exist")).toBeUndefined();
  });
});
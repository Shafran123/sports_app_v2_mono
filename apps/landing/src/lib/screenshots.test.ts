import { describe, expect, it } from "vitest";
import { getScreenshot, resolveScreenshot, screenshots } from "./screenshots";

describe("screenshot config", () => {
  it("declares one screenshot per feature slot (hero + 5 owner + 2 player)", () => {
    expect(screenshots).toHaveLength(8);
  });

  it("includes the hero slot and both player slots", () => {
    const ids = screenshots.map((shot) => shot.id);
    expect(ids).toContain("hero-player");
    expect(ids).toContain("player-venue-detail");
    expect(ids).toContain("player-confirmation");
    expect(ids).not.toContain("players");
  });

  it("ids are unique", () => {
    const ids = screenshots.map((shot) => shot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry carries an id, label, and frame kind", () => {
    for (const shot of screenshots) {
      expect(shot.id).toBeTruthy();
      expect(shot.label).toBeTruthy();
      expect(["phone", "browser"]).toContain(shot.frame);
    }
  });

  it("placeholder entries have no src yet, so they resolve to null (render the mock)", () => {
    const placeholders = screenshots.filter((shot) => !shot.src);
    expect(placeholders).toHaveLength(2);
    for (const shot of placeholders) {
      expect(resolveScreenshot(shot)).toBeNull();
    }
  });

  it("six phone-framed slots resolve to real screenshots under /shots/", () => {
    const withSrc = screenshots.filter((shot) => shot.src);
    expect(withSrc).toHaveLength(6);
    for (const shot of withSrc) {
      expect(shot.src).toMatch(/^\/shots\/[a-z0-9-]+\.png$/);
      expect(shot.frame).toBe("phone");
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
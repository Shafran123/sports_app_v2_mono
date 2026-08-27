import { describe, expect, it } from "vitest";
import { getScreenshot, resolveScreenshot, screenshots } from "./screenshots";

describe("screenshot config", () => {
  it("declares one screenshot per owner feature slot", () => {
    expect(screenshots).toHaveLength(4);
  });

  it("includes the dedicated-site slot and no player, payments, or events slots", () => {
    const ids = screenshots.map((shot) => shot.id);
    expect(ids).toContain("dedicated-site");
    expect(ids).not.toContain("hero-player");
    expect(ids).not.toContain("player-venue-detail");
    expect(ids).not.toContain("player-confirmation");
    expect(ids).not.toContain("payments");
    expect(ids).not.toContain("events");
    expect(ids).not.toContain("players");
  });

  it("ids are unique", () => {
    const ids = screenshots.map((shot) => shot.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry carries an id, label, and a known frame kind", () => {
    for (const shot of screenshots) {
      expect(shot.id).toBeTruthy();
      expect(shot.label).toBeTruthy();
      expect(["phone", "tablet", "browser"]).toContain(shot.frame);
    }
  });

  it("every slot now carries a real screenshot under /shots/", () => {
    const withSrc = screenshots.filter((shot) => shot.src);
    expect(withSrc).toHaveLength(4);
    for (const shot of withSrc) {
      expect(shot.src).toMatch(/^\/shots\/[a-z0-9-]+\.png$/);
    }
  });

  it("the dedicated site is phone-framed; the admin console slots are tablet-framed", () => {
    const dedicated = getScreenshot("dedicated-site");
    expect(dedicated?.frame).toBe("phone");
    for (const id of ["real-time-bookings", "front-desk", "owner-dashboard"]) {
      expect(getScreenshot(id)?.frame).toBe("tablet");
    }
  });

  it("an entry with a src resolves to the image URL (the one-line swap)", () => {
    const withSrc = { id: "x", label: "X", frame: "tablet", src: "/shots/real.png" } as const;
    expect(resolveScreenshot(withSrc)).toBe("/shots/real.png");
  });

  it("looks up a screenshot by id and returns undefined for unknown ids", () => {
    expect(getScreenshot("owner-dashboard")?.id).toBe("owner-dashboard");
    expect(getScreenshot("does-not-exist")).toBeUndefined();
  });
});
import { describe, expect, it } from "vitest";
import { copy } from "./copy";

describe("landing copy", () => {
  it("labels the hero CTA as a demo, not a free trial", () => {
    expect(copy.hero.primaryCta).toBe("Book a demo with us");
    expect(copy.hero.primaryCta).not.toMatch(/free trial/i);
  });

  it("labels the inquiry submit as a demo", () => {
    expect(copy.inquire.submit).toBe("Book a demo");
  });

  it("keeps the 3-month free trial as the offer, not the button", () => {
    expect(copy.hero.body).toContain("free for 3 months");
    expect(copy.howItWorks.steps[1].body).toContain("3-month free plan");
    expect(copy.trialBand.title).toContain("free for 3 months");
    expect("cta" in copy.trialBand).toBe(false);
  });

  it("adds a For players nav link", () => {
    expect(copy.nav.players).toBe("For players");
  });

  it("keeps five owner feature sections and drops the old players one", () => {
    expect(copy.features.items).toHaveLength(5);
    expect(copy.features.items.some((f) => f.id === "players")).toBe(false);
  });

  it("declares two player feature sections with distinct ids", () => {
    expect(copy.playerFeatures.items).toHaveLength(2);
    const ids = copy.playerFeatures.items.map((f) => f.id);
    expect(ids).toEqual(["player-venue-detail", "player-confirmation"]);
    expect(copy.playerFeatures.items[0].cta?.label).toBe("Explore the player app");
  });

  it("declares a photo strip with three photos carrying src and alt", () => {
    expect(copy.photoStrip.photos).toHaveLength(3);
    for (const photo of copy.photoStrip.photos) {
      expect(photo.src).toMatch(/^\/photos\//);
      expect(photo.alt.length).toBeGreaterThan(0);
    }
  });

  it("declares draft social proof stats and testimonials", () => {
    expect(copy.socialProof.draft).toBe(true);
    expect(copy.socialProof.stats).toHaveLength(3);
    expect(copy.socialProof.testimonials).toHaveLength(2);
    for (const stat of copy.socialProof.stats) {
      expect(stat.value.length).toBeGreaterThan(0);
      expect(stat.label.length).toBeGreaterThan(0);
    }
    for (const t of copy.socialProof.testimonials) {
      expect(t.quote.length).toBeGreaterThan(0);
      expect(t.author.length).toBeGreaterThan(0);
    }
  });
});
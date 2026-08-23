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

  it("adds a For players nav link and a mobile demo CTA", () => {
    expect(copy.nav.players).toBe("For players");
    expect(copy.nav.mobileCta).toBe("Book a demo");
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

  it("has no photo strip and no fabricated social proof", () => {
    expect("photoStrip" in copy).toBe(false);
    expect("socialProof" in copy).toBe(false);
  });

  it("keeps the trial band sub honest at pre-launch", () => {
    expect(copy.trialBand.sub).not.toContain("thousands");
    expect(copy.trialBand.sub).toContain("first");
  });

  it("has a working contact email and no dead footer links or player column", () => {
    expect(copy.footer.contactEmail).toBe("info@myslot.lk");
    const titles = copy.footer.columns.map((c) => c.title);
    expect(titles).not.toContain("Players");
    const flat = copy.footer.columns.flatMap((c) => c.links);
    expect(flat.some((l) => l.label === "About")).toBe(false);
    expect(flat.some((l) => l.label === "Explore the player app")).toBe(false);
    expect(flat.some((l) => l.label === "Contact")).toBe(true);
  });

  it("declares a one-word rotating USP headline", () => {
    expect(copy.hero.usps.length).toBeGreaterThanOrEqual(3);
    const set = new Set(copy.hero.usps);
    expect(set.size).toBe(copy.hero.usps.length);
    for (const word of copy.hero.usps) {
      expect(word.split(" ")).toHaveLength(1);
      expect(word.length).toBeGreaterThan(0);
    }
    expect(copy.hero.headline).toBe(copy.hero.usps[0]);
    expect(copy.hero.headlineLead.length).toBeGreaterThan(0);
    expect(copy.hero.finePrint.length).toBeGreaterThan(0);
    expect("headlinePrefix" in copy.hero).toBe(false);
    expect("headlineRotations" in copy.hero).toBe(false);
  });
});
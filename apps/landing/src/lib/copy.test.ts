import { describe, expect, it } from "vitest";
import { contact, copy } from "./copy";

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

  it("pitches the dedicated website to sports facility owners", () => {
    expect(copy.hero.body).toMatch(/sports facility/i);
    expect(copy.hero.body).toMatch(/dedicated website/i);
    expect(copy.hero.usps).toContain("Own website");
  });

  it("keeps the owner feature sections and drops players, payments, and events", () => {
    expect(copy.features.items).toHaveLength(4);
    const ids = copy.features.items.map((f) => f.id);
    expect(ids).toEqual(["dedicated-site", "real-time-bookings", "front-desk", "owner-dashboard"]);
    expect(ids.some((f) => f === "players")).toBe(false);
    expect(ids.some((f) => f === "payments")).toBe(false);
    expect(ids.some((f) => f === "events")).toBe(false);
    expect("playerFeatures" in copy).toBe(false);
  });

  it("does not market payments or events before they are live", () => {
    const allCopy = JSON.stringify(copy);
    expect(allCopy).not.toMatch(/PayHere/i);
    expect(allCopy).not.toMatch(/Payments your way/i);
    expect(allCopy).not.toMatch(/Events & registrations/i);
    expect(allCopy).not.toMatch(/Cashless/i);
  });

  it("declares no player feature sections anymore", () => {
    expect("playerFeatures" in copy).toBe(false);
  });

  it("has no photo strip and no fabricated social proof", () => {
    expect("photoStrip" in copy).toBe(false);
    expect("socialProof" in copy).toBe(false);
  });

  it("keeps the trial band sub honest at pre-launch", () => {
    expect(copy.trialBand.sub).not.toContain("thousands");
    expect(copy.trialBand.sub).toContain("first");
  });

  it("exposes a working contact block with address, phone, and email", () => {
    expect(contact.email).toBe("info@myslot.lk");
    expect(contact.address).toMatch(/Galle/);
    expect(contact.phone).toMatch(/^\+94 /);
    expect(contact.phoneHref).toMatch(/^\+94\d{9}$/);
  });

  it("footer lists Product and Legal columns with no player column", () => {
    const titles = copy.footer.columns.map((c) => c.title);
    expect(titles).toContain("Legal");
    expect(titles).not.toContain("Players");
    const flat = copy.footer.columns.flatMap((c) => c.links);
    const labels = flat.map((l) => l.label);
    expect(labels).toEqual(expect.arrayContaining(["Privacy Policy", "Terms & Conditions", "FAQ"]));
    expect(flat.some((l) => l.label === "About")).toBe(false);
  });

  it("declares a rotating USP headline with short phrases", () => {
    expect(copy.hero.usps.length).toBeGreaterThanOrEqual(3);
    const set = new Set(copy.hero.usps);
    expect(set.size).toBe(copy.hero.usps.length);
    for (const word of copy.hero.usps) {
      expect(word.length).toBeGreaterThan(0);
    }
    expect(copy.hero.headline).toBe(copy.hero.usps[0]);
    expect(copy.hero.headlineLead.length).toBeGreaterThan(0);
    expect(copy.hero.finePrint.length).toBeGreaterThan(0);
    expect("headlinePrefix" in copy.hero).toBe(false);
    expect("headlineRotations" in copy.hero).toBe(false);
  });

  it("lists the owner capabilities in a detailed table", () => {
    expect(copy.capabilities.items.length).toBeGreaterThanOrEqual(10);
    for (const item of copy.capabilities.items) {
      expect(item.term.length).toBeGreaterThan(0);
      expect(item.desc.length).toBeGreaterThan(0);
    }
    const terms = copy.capabilities.items.map((item) => item.term);
    expect(terms).toEqual(
      expect.arrayContaining([
        "Your own dedicated website",
        "Embeddable booking widget",
        "Multiple courts",
        "Cancellation cutoff",
        "Transparent tax",
        "Offers & discounts",
        "Flexible opening windows",
        "Variable pricing",
        "Reports",
        "A clear plan & agreement"
      ])
    );
  });

  it("declares a healthy FAQ and legal pages", () => {
    expect(copy.faq.items.length).toBeGreaterThanOrEqual(6);
    for (const item of copy.faq.items) {
      expect(item.q.length).toBeGreaterThan(0);
      expect(item.a.length).toBeGreaterThan(0);
    }
    expect(copy.legal.privacy.paragraphs.length).toBeGreaterThan(0);
    expect(copy.legal.terms.paragraphs.length).toBeGreaterThan(0);
  });
});
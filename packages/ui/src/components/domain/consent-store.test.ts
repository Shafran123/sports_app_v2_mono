import { beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  closeConsentManager,
  getConsentChoice,
  hasConsentChoice,
  isConsentBannerVisible,
  openConsentManager,
  setConsentChoice,
  subscribeConsentChange
} from "./consent-store";

const KEY = CONSENT_STORAGE_KEY;

function store(record: unknown): void {
  window.localStorage.setItem(KEY, JSON.stringify(record));
}

describe("analytics consent store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    closeConsentManager();
  });

  it("starts with no choice when nothing is stored", () => {
    expect(getConsentChoice()).toBeNull();
    expect(hasConsentChoice()).toBe(false);
    expect(isConsentBannerVisible()).toBe(true);
  });

  it("records a choice and hides the blocking banner", () => {
    setConsentChoice("accepted");
    expect(getConsentChoice()).toBe("accepted");
    expect(hasConsentChoice()).toBe(true);
    expect(isConsentBannerVisible()).toBe(false);
  });

  it("persists the choice across reloads (per origin)", () => {
    setConsentChoice("rejected");
    const record = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    expect(record.choice).toBe("rejected");
    expect(record.version).toBe(CONSENT_VERSION);
    expect(record.updatedAt).toBeTruthy();
    // simulate a fresh module
    expect(getConsentChoice()).toBe("rejected");
  });

  it("re-prompts when the stored version is stale", () => {
    store({ choice: "accepted", version: CONSENT_VERSION - 1, updatedAt: "x" });
    expect(getConsentChoice()).toBeNull();
    expect(isConsentBannerVisible()).toBe(true);
  });

  it("ignores a corrupted record", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(getConsentChoice()).toBeNull();
  });

  it("ignores a record with an unknown choice", () => {
    store({ choice: "maybe", version: CONSENT_VERSION });
    expect(getConsentChoice()).toBeNull();
  });

  it("reopens the manager and shows a close path with a choice present", () => {
    setConsentChoice("accepted");
    expect(isConsentBannerVisible()).toBe(false);
    openConsentManager();
    expect(isConsentBannerVisible()).toBe(true);
    closeConsentManager();
    expect(isConsentBannerVisible()).toBe(false);
  });

  it("changing a choice through the manager updates the record", () => {
    setConsentChoice("accepted");
    openConsentManager();
    setConsentChoice("rejected");
    expect(getConsentChoice()).toBe("rejected");
    expect(isConsentBannerVisible()).toBe(false);
  });

  it("notifies subscribers on choice and visibility changes", () => {
    const seen: string[] = [];
    subscribeConsentChange(() => seen.push(String(isConsentBannerVisible())));
    setConsentChoice("accepted");
    openConsentManager();
    closeConsentManager();
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });
});

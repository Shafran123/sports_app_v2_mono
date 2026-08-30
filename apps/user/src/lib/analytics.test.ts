import { beforeEach, describe, expect, it, vi } from "vitest";
import { setConsentChoice } from "@myslot/ui";

const { initializeAppMock, getAnalyticsMock, logEventMock } = vi.hoisted(() => ({
  initializeAppMock: vi.fn(),
  getAnalyticsMock: vi.fn(),
  logEventMock: vi.fn()
}));

vi.mock("firebase/app", () => ({
  initializeApp: initializeAppMock
}));

vi.mock("firebase/analytics", () => ({
  getAnalytics: getAnalyticsMock,
  logEvent: logEventMock
}));

import { isAnalyticsEnabled, trackEvent } from "./analytics";

const MEASUREMENT_ID = "G-ABC123";
const FIREBASE_ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "myslot.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "myslot",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:2:web:abc"
};

function setFirebaseEnv(measurementId: string | null) {
  for (const [key, value] of Object.entries(FIREBASE_ENV)) {
    process.env[key] = value;
  }
  if (measurementId === null) {
    delete process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  } else {
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = measurementId;
  }
}

function clearFirebaseEnv() {
  for (const key of Object.keys(FIREBASE_ENV)) {
    delete process.env[key];
  }
  delete process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
}

describe("analytics gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setConsentChoice("accepted");
  });

  afterEach(() => {
    clearFirebaseEnv();
  });

  it("reports disabled without the measurement ID", () => {
    setFirebaseEnv(null);
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("reports enabled with the measurement ID", () => {
    setFirebaseEnv(MEASUREMENT_ID);
    expect(isAnalyticsEnabled()).toBe(true);
  });

  it("trackEvent is a no-op without the measurement ID", () => {
    setFirebaseEnv(null);
    getAnalyticsMock.mockReturnValue({});
    trackEvent("cta_click", { cta: "hero" });
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("trackEvent initializes Firebase and logs when enabled and consented", () => {
    setFirebaseEnv(MEASUREMENT_ID);
    const app = { name: "test-app" };
    const analytics = { mock: "analytics" };
    initializeAppMock.mockReturnValue(app);
    getAnalyticsMock.mockReturnValue(analytics);

    trackEvent("cta_click", { cta: "hero" });

    expect(initializeAppMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "myslot", appId: FIREBASE_ENV.NEXT_PUBLIC_FIREBASE_APP_ID })
    );
    expect(getAnalyticsMock).toHaveBeenCalledWith(app);
    expect(logEventMock).toHaveBeenCalledWith(analytics, "cta_click", { cta: "hero" });
  });

  it("trackEvent is a no-op before the visitor accepts consent", () => {
    setFirebaseEnv(MEASUREMENT_ID);
    setConsentChoice("rejected");
    trackEvent("cta_click", { cta: "hero" });
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("a failing analytics call never throws", () => {
    setFirebaseEnv(MEASUREMENT_ID);
    getAnalyticsMock.mockReturnValue({});
    logEventMock.mockImplementation(() => {
      throw new Error("analytics down");
    });

    expect(() => trackEvent("cta_click")).not.toThrow();
  });
});

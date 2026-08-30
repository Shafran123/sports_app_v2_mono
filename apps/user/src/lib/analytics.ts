import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, logEvent, type Analytics } from "firebase/analytics";
import { getConsentChoice, subscribeConsentChange } from "@myslot/ui";

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

/**
 * Analytics is opt-in per deployment. Without a measurement ID the Firebase
 * modules are never initialized and every call is a no-op. On top of that,
 * analytics only ever runs after the visitor records an explicit Accept
 * (Analytics Consent, ADR-0043): until then this module is inert.
 */
export function isAnalyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);
}

function consentAccepted(): boolean {
  return getConsentChoice() === "accepted";
}

function client(): Analytics | null {
  if (!isAnalyticsEnabled() || !consentAccepted()) return null;
  if (!analytics) {
    app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    });
    analytics = getAnalytics(app);
  }
  return analytics;
}

/**
 * Fire a GA4 event. Fire-and-forget: a failing analytics call must never
 * affect rendering, and without consent or a measurement id this is a no-op.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const a = client();
  if (!a) return;
  try {
    logEvent(a, name, params ?? {});
  } catch {
    // analytics must never take the page down with it
  }
}

/** Single wrapper for CTA clicks so every call site stays one line. */
export function trackCta(cta: string): void {
  trackEvent("cta_click", { cta });
}

// Initialize eagerly once consent is granted (so GA4's automatic page_view
// and session tracking start immediately), and on load if a returning visitor
// already accepted. SSR-safe: the consent store is inert and window is
// undefined on the server.
if (typeof window !== "undefined") {
  if (isAnalyticsEnabled() && consentAccepted()) {
    client();
  }
  subscribeConsentChange(() => {
    if (isAnalyticsEnabled() && consentAccepted()) {
      client();
    }
  });
}

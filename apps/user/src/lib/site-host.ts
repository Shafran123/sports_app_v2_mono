"use client";

// Client-side site-host detection: is this browser session on a Dedicated
// Site (a hostname other than the platform app) rather than the marketplace?
// The server branch (getSiteContext) decides what renders; the client needs
// the same fact to carry site context into data fetches and checkout.

export function currentHostname(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname;
}

// True when the current host differs from the platform app's own hostname
// (from the public flags `app_url`) — i.e. we're on a Business's site.
export function isSiteHost(appUrl?: string | null): boolean {
  const host = currentHostname();
  if (!host || !appUrl) return false;
  try {
    return new URL(appUrl).hostname.toLowerCase() !== host.toLowerCase();
  } catch {
    return false;
  }
}
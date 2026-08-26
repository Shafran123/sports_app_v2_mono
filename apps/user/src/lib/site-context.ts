import { headers } from "next/headers";
import { cache } from "react";
import type { SiteConfig } from "@myslot/types";

// Server-side Dedicated Site context (ADR-0029): the user app serves the
// marketplace shell on its own hostname and a Business's white-labeled site
// on a LIVE Site Hostname. This resolves "is the current host a live site,
// and whose is it?" once per page render (force-dynamic pages, no cache —
// live sites change only through the admin workflow, but a hostname flipping
// live must reflect immediately). Wrapped in React cache() so a single
// request's layout + page share one resolution.

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2400";

export async function currentHost(): Promise<string> {
  const h = await headers();
  const raw = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.trim() ?? "";
  // Strip an explicit port (dev: `mysite.localhost:3000`) so hostname
  // comparisons match the stored Site Hostname, which never carries one.
  return raw.replace(/:\d+$/, "");
}

// Platform-owned subdomains (`<brand>.myslot.lk`) are teaser/staging surface:
// indexable custom domains, noindex platform subdomains (grill Q10).
export function isPlatformSubdomain(host: string): boolean {
  return host.toLowerCase().endsWith(".myslot.lk");
}

export const getSiteContext = cache(async (): Promise<SiteConfig | null> => {
  const host = await currentHost();
  if (!host) return null;
  try {
    const res = await fetch(
      `${BACKEND}/api/v1/public/site/by-hostname?host=${encodeURIComponent(host)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const body: { data?: SiteConfig } = await res.json();
    return body?.data ?? null;
  } catch {
    return null;
  }
});
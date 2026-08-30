"use client";

import { usePathname } from "next/navigation";
import { ConsentBanner } from "@myslot/ui";
import { useBrandName } from "@/hooks/use-brand-name";

/**
 * The app's Analytics Consent banner (ADR-0043), shown everywhere except the
 * Booking Widget iframe (`/embed/...`) — a third-party frame where a blocking
 * consent banner does not belong.
 */
export function ConsentGate() {
  const pathname = usePathname();
  const brand = useBrandName();

  if (pathname?.startsWith("/embed")) return null;

  return <ConsentBanner brandName={brand} privacyHref="/privacy" />;
}

"use client";

import { ConsentBanner as ConsentBannerBase } from "@myslot/ui";
import { useBrandName } from "@/hooks/use-brand-name";

/** The landing app's Analytics Consent banner, brand-aware. */
export function ConsentBanner() {
  const brand = useBrandName();
  return <ConsentBannerBase brandName={brand} privacyHref="/privacy" />;
}

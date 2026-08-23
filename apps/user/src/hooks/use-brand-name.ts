"use client";

import { useQuery } from "@tanstack/react-query";
import { featureFlags } from "@myslot/api";
import { DEFAULT_BRAND_NAME } from "@myslot/utils";

/** Current admin-configured brand name, falling back to the default. */
export function useBrandName(): string {
  const { data } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlags.get()
  });
  return data?.brand_name ?? DEFAULT_BRAND_NAME;
}
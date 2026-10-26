import type { MetadataRoute } from "next";
import { currentHost, getSiteContext, isPlatformSubdomain } from "@/lib/site-context";

export const dynamic = "force-dynamic";

// A live Dedicated Site on the owner's own domain lists its home and one URL per
// venue. Platform subdomains and the platform host list nothing.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = await currentHost();
  const site = await getSiteContext();
  if (!site || isPlatformSubdomain(host)) return [];
  const origin = `https://${host}`;
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    ...site.venues
      .filter((venue) => venue.slug)
      .map((venue) => ({ url: `${origin}/${venue.slug}`, changeFrequency: "weekly" as const, priority: 0.8 }))
  ];
}

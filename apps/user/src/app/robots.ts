import type { MetadataRoute } from "next";
import { currentHost, getSiteContext, isPlatformSubdomain } from "@/lib/site-context";

// Host-aware (ADR-0029): one app serves every Dedicated Site hostname, so the
// robots file is resolved per request. Only a live owner-domain site advertises
// a sitemap; platform subdomains and the platform host stay noindex via meta.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await currentHost();
  const site = await getSiteContext();
  const indexable = Boolean(site) && !isPlatformSubdomain(host);
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/embed/"] },
    ...(indexable ? { sitemap: `https://${host}/sitemap.xml` } : {})
  };
}

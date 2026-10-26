import { MarketplaceClosed } from "@/features/marketplace/marketplace-closed";
import { HomePage } from "@/features/home/home-page";
import { SiteHome } from "@/features/site/site-home";
import { getSiteContext, isPlatformSubdomain, currentHost } from "@/lib/site-context";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteContext();
  if (site) {
    return {
      title: site.business.brand?.tagline
        ? `${site.business.name} — ${site.business.brand.tagline}`
        : site.business.name,
      description:
        site.business.brand?.about ||
        `Book courts online at ${site.business.name}. Real-time availability and instant confirmation.`,
      robots: isPlatformSubdomain(await currentHost()) ? { index: false, follow: true } : { index: true, follow: true }
    };
  }
  // Platform host: the marketplace is closed (ADR-0045), nothing here to index.
  return { robots: { index: false, follow: true } };
}

// Marketplace retirement (ADR-0045): the marketplace home is closed to
// customers; site-hosted visitors still land on their venue's site home.
export default async function Page() {
  const site = await getSiteContext();
  if (site) return <SiteHome config={site} />;
  return <MarketplaceClosed />;
}
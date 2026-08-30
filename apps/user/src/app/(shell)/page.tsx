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
      robots: isPlatformSubdomain(await currentHost()) ? { index: false, follow: true } : { index: true, follow: true }
    };
  }
  return {};
}

// Marketplace retirement (ADR-0045): the marketplace home is closed to
// customers; site-hosted visitors still land on their venue's site home.
export default async function Page() {
  const site = await getSiteContext();
  if (site) return <SiteHome config={site} />;
  return <MarketplaceClosed />;
}
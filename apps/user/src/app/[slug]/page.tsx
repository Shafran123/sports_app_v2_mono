import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BrandedVenuePage } from "@/features/widget/branded-venue-page";
import { SiteChrome } from "@/features/site/site-chrome";
import { VenueDetailPage } from "@/features/venue-detail/venue-detail-page";
import { VenueSeoSummary } from "@/features/venue-detail/venue-seo-summary";
import { getSiteContext, currentHost, isPlatformSubdomain } from "@/lib/site-context";
import { prettyCity, jsonLdString, venueDescription, venueJsonLd } from "@/lib/venue-seo";
import { VenueDetailSchema, type VenueDetail, type WidgetConfig } from "@myslot/types";
import { cache } from "react";

export const dynamic = "force-dynamic";

async function fetchVenueBySlug(slug: string): Promise<WidgetConfig | null> {
  try {
    const backend = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2400";
    // no-store: availability, prices and brand tokens are live venue data.
    const res = await fetch(`${backend}/api/v1/venues/by-slug/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });
    if (!res.ok) return null;
    const body: { data?: WidgetConfig } = await res.json();
    return body?.data ?? null;
  } catch {
    return null;
  }
}

// Full venue detail (courts, hours, photos) for server-rendered content and
// structured data. A site host passes its hostname so private venues serve.
const fetchVenueDetail = cache(async (id: string, siteHost: string): Promise<VenueDetail | null> => {
  try {
    const backend = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2400";
    const res = await fetch(`${backend}/api/v1/venues/${encodeURIComponent(id)}?site_hostname=${encodeURIComponent(siteHost)}`, {
      cache: "no-store"
    });
    if (!res.ok) return null;
    const body = await res.json();
    const parsed = VenueDetailSchema.safeParse(body?.data ?? body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSiteContext();
  if (site) {
    const venue = site.venues.find((v) => v.slug === slug);
    if (!venue) return {};
    const host = await currentHost();
    const detail = await fetchVenueDetail(venue.id, host);
    const city = prettyCity(detail?.city ?? venue.city);
    const title = city ? `${venue.name} — ${city}` : venue.name;
    const description = detail
      ? venueDescription(detail, site.business.brand?.about)
      : site.business.brand?.about || `Book courts at ${venue.name}. Real-time availability, instant confirmation.`;
    const image = (detail?.photos[0] ?? venue.photos[0]) || site.business.brand?.banner_image;
    return {
      metadataBase: new URL(`https://${host}`),
      title,
      description,
      alternates: { canonical: `/${slug}` },
      openGraph: {
        type: "website",
        siteName: site.business.name,
        title,
        description,
        url: `/${slug}`,
        ...(image ? { images: [image] } : {})
      },
      twitter: { card: image ? "summary_large_image" : "summary", title, description },
      robots: isPlatformSubdomain(host) ? { index: false, follow: true } : { index: true, follow: true }
    };
  }
  const venue = await fetchVenueBySlug(slug);
  if (!venue) return {};
  const tagline = venue.business?.brand?.tagline;
  return {
    title: tagline ? `${venue.name} — ${tagline}` : venue.name,
    description:
      venue.business?.brand?.about ||
      `Book courts at ${venue.name} in ${venue.city}. Real-time availability, instant confirmation.`,
    robots: { index: true, follow: true }
  };
}

export default async function VenueSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();

  // On a live Site Hostname the same /<slug> URL is the site's venue page:
  // site chrome + the full app venue detail (booking flow, sign-in, checkout).
  const site = await getSiteContext();
  if (site) {
    const venue = site.venues.find((v) => v.slug === slug);
    if (!venue) notFound();
    const host = await currentHost();
    const detail = await fetchVenueDetail(venue.id, host);
    return (
      <SiteChrome config={site}>
        {detail && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLdString(
                venueJsonLd(detail, { origin: `https://${host}`, path: `/${slug}`, businessName: site.business.name })
              )
            }}
          />
        )}
        <VenueDetailPage
          venueId={venue.id}
          loadingFallback={detail ? <VenueSeoSummary venue={detail} /> : undefined}
        />
      </SiteChrome>
    );
  }

  const venue = await fetchVenueBySlug(slug);
  if (!venue) notFound();

  // Slug-based branded pages are superseded for site businesses (ADR-0029):
  // once a Business has a live site, its myslot.lk/<slug> URL hands off to the
  // venue's page on the site host. No loop — on the site host the branch above
  // catches before this.
  if (venue.business?.site_hostname && venue.business.site_hostname !== (await currentHost())) {
    redirect(`https://${venue.business.site_hostname}/${slug}`);
  }

  return <BrandedVenuePage venue={venue} />;
}
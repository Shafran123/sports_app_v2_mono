import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandedVenuePage } from "@/features/widget/branded-venue-page";
import type { WidgetConfig } from "@myslot/types";

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const venue = await fetchVenueBySlug(slug);
  if (!venue) return {};
  const tagline = venue.brand?.tagline;
  return {
    title: tagline ? `${venue.name} — ${tagline}` : venue.name,
    description:
      venue.brand?.about ||
      `Book courts at ${venue.name} in ${venue.city}. Real-time availability, instant confirmation.`,
    robots: { index: true, follow: true }
  };
}

export default async function VenueSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();
  const venue = await fetchVenueBySlug(slug);
  if (!venue) notFound();
  return <BrandedVenuePage venue={venue} />;
}
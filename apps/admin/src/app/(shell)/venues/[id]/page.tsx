import { VenueDetailPage } from "@/features/admin-venues/venue-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VenueDetailPage venueId={id} />;
}
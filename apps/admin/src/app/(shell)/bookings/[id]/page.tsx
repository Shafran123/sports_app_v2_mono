import { BookingDetailPage } from "@/features/admin-bookings/booking-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetailPage bookingId={id} />;
}
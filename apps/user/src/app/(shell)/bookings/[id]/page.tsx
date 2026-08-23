import { Suspense } from "react";
import { BookingConfirmationPage } from "@/features/booking-confirmation/booking-confirmation-page";
import { SkeletonRow } from "@myslot/ui";

export default async function BookingConfirmationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl space-y-4"><SkeletonRow /></div>}>
      <BookingConfirmationPage bookingId={id} />
    </Suspense>
  );
}
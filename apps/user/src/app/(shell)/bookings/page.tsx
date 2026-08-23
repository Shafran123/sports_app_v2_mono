import { Suspense } from "react";
import { BookingsList } from "@/features/bookings/bookings-list";
import { SkeletonRow } from "@myslot/ui";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl space-y-4"><SkeletonRow /><SkeletonRow /></div>}>
      <BookingsList />
    </Suspense>
  );
}
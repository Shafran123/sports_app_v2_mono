import { Suspense } from "react";
import { CheckoutPage } from "@/features/checkout/checkout-page";
import { SkeletonRow } from "@myslot/ui";

export default async function CheckoutRoute({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl space-y-4"><SkeletonRow /></div>}>
      <CheckoutPage venueId={venueId} />
    </Suspense>
  );
}
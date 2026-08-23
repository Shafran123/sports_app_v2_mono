import { Suspense } from "react";
import { EventsListPage } from "@/features/events/events-list-page";
import { SkeletonCard } from "@myslot/ui";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      }
    >
      <EventsListPage />
    </Suspense>
  );
}
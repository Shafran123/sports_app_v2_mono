"use client";

import Link from "next/link";
import { buttonVariants } from "@myslot/ui";
import { cn } from "@myslot/utils";
import type { Feature } from "@/lib/copy";
import { DeviceFrame } from "../device-frame";
import { TrackSection } from "../track-section";
import {
  MockBookings,
  MockConfirmation,
  MockDashboard,
  MockEvents,
  MockFrontDesk,
  MockPayments,
  MockVenueDetail
} from "./mockups";

const MOCKUPS: Record<string, () => React.ReactNode> = {
  "real-time-bookings": MockBookings,
  "front-desk": MockFrontDesk,
  payments: MockPayments,
  events: MockEvents,
  "owner-dashboard": MockDashboard,
  "player-venue-detail": MockVenueDetail,
  "player-confirmation": MockConfirmation
};

function mockFor(featureId: string): () => React.ReactNode {
  const mock = MOCKUPS[featureId];
  if (!mock) throw new Error(`No mockup registered for feature "${featureId}"`);
  return mock;
}

export function FeatureSection({ feature, flip }: { feature: Feature; flip?: boolean }) {
  const Mockup = mockFor(feature.id);
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2">
      <TrackSection name={`feature:${feature.id}`} />
      <div className={cn("min-w-0", flip && "lg:order-2")}>
        <DeviceFrame shotId={feature.id} className="animate-fade-in">
          <Mockup />
        </DeviceFrame>
      </div>
      <div className="min-w-0 space-y-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{feature.eyebrow}</p>
        <h3 className="font-display text-2xl font-extrabold tracking-tight text-ink">{feature.heading}</h3>
        <p className="text-ink-2">{feature.body}</p>
        <ul className="space-y-2 text-ink-2">
          {feature.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        {feature.cta && (
          <Link href={feature.cta.href} className={buttonVariants({ variant: "primary", size: "lg" })}>
            {feature.cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
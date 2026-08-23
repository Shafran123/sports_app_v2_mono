"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@myslot/ui";
import { Hero } from "./hero";
import { PopularSports } from "./popular-sports";
import { VenuesNearYou } from "./venues-near-you";

export function HomePage() {
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-8 md:pb-16">
      <Hero />
      <OwnerCtaBanner />
      <PopularSports />
      <VenuesNearYou />
    </main>
  );
}

function OwnerCtaBanner() {
  return (
    <section className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Own a venue? List it on MySlot.LK</h2>
          <p className="mt-1 text-sm text-ink-2">
            Fill in the form and our team will reach out to set up your venue and plan.
          </p>
        </div>
      </div>
      <Link href="/become-owner">
        <Button>List your place</Button>
      </Link>
    </section>
  );
}
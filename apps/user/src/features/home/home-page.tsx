"use client";

import { Hero } from "./hero";
import { PopularSports } from "./popular-sports";
import { VenuesNearYou } from "./venues-near-you";

export function HomePage() {
  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-8 md:pb-16">
      <Hero />
      <PopularSports />
      <VenuesNearYou />
    </main>
  );
}
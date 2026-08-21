"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button, Input } from "@spots/ui";

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-light via-surface to-surface p-8 shadow-soft md:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary-light/70 blur-3xl"
      />
      <p className="relative text-sm font-semibold uppercase tracking-widest text-primary">Find your game</p>
      <h1 className="relative mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-ink md:text-6xl">
        Your next match starts here.
      </h1>
      <p className="relative mt-3 max-w-xl text-ink-2">
        Book courts, join games, find players and discover sports near you.
      </p>
      <form
        className="relative mt-6 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(query.trim() ? `/explore?search=${encodeURIComponent(query.trim())}` : "/explore");
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search venues, sports or activities"
          aria-label="Search venues, sports or activities"
          className="h-14 w-full flex-1 rounded-full bg-paper/70 text-base sm:h-12"
        />
        <Button type="submit" size="lg" className="w-full sm:h-12 sm:w-auto">
          <Search className="h-4 w-4" /> Find Sports
        </Button>
      </form>
    </section>
  );
}
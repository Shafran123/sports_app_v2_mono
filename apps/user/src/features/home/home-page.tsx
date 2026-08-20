"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button, Input } from "@spots/ui";

export function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
      <section className="rounded-3xl border border-border bg-surface p-8 shadow-soft md:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Find your game</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-ink md:text-6xl">
          Your next match starts here.
        </h1>
        <p className="mt-3 max-w-xl text-ink-2">
          Book courts, join games, find players and discover sports near you.
        </p>
        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(query.trim() ? `/explore?search=${encodeURIComponent(query.trim())}` : "/explore");
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search venues, sports or activities"
            className="h-12 flex-1 rounded-full"
          />
          <Button type="submit" size="lg" className="sm:h-12">
            <Search className="h-4 w-4" /> Find Sports
          </Button>
        </form>
      </section>
    </main>
  );
}
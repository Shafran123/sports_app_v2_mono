"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button, Input } from "@spots/ui";

const ROTATING_WORDS = [
  "Badminton",
  "Cricket",
  "Football",
  "Tennis",
  "Basketball",
  "Swimming",
  "Volleyball"
];

const ROTATE_INTERVAL_MS = 2400;

function useRotatingWord(words: string[]): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [words]);

  return words[index] ?? words[0] ?? "";
}

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const word = useRotatingWord(ROTATING_WORDS);

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
        <div className="relative w-full flex-1">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Search venues, sports or activities"
            className="h-12 w-full rounded-full pl-12 pr-4 text-base"
          />
          {query === "" && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-12 top-1/2 flex -translate-y-1/2 overflow-hidden text-base text-ink-3 ${
                focused ? "[animation-play-state:paused]" : ""
              }`}
            >
              <span key={word} className="block animate-word-roll whitespace-nowrap">
                Search for {word}
              </span>
            </span>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full sm:h-12 sm:w-auto">
          <Search className="h-4 w-4" /> Find Sports
        </Button>
      </form>
    </section>
  );
}
"use client";

import { copy } from "@/lib/copy";

export function ScrollCue() {
  return (
    <a
      href="#how-it-works"
      className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-ink-3 transition-colors hover:text-ink"
      aria-label="Scroll to see how it works"
    >
      <span className="text-xs font-medium uppercase tracking-wide">{copy.hero.scrollCue}</span>
      <svg
        className="h-5 w-5 animate-bounce"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </a>
  );
}
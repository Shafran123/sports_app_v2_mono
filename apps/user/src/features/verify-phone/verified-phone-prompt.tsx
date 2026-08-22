"use client";

import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

export function VerifiedPhonePrompt({ onVerify }: { onVerify: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Phone verification required"
      className="flex items-start justify-between gap-3 rounded-3xl border border-warning/40 bg-warning-light px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold text-ink">Verify your phone to book your game</p>
          <p className="mt-0.5 text-sm text-ink-2">
            You&apos;ll be asked to verify before checkout — better to do it now.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onVerify}
          className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Verify now
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="I'll do it later"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
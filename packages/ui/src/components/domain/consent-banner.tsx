"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  closeConsentManager,
  getConsentChoice,
  isConsentBannerVisible,
  setConsentChoice,
  subscribeConsentChange
} from "./consent-store";
import { Button } from "../ui/button";

export interface ConsentBannerProps {
  brandName?: string;
  privacyHref?: string;
}

/**
 * The Analytics Consent banner (ADR-0043). Blocking on first visit until the
 * visitor chooses Accept or Reject; once a choice exists it hides, and
 * reopens as a non-blocking manager via openConsentManager().
 *
 * Client-only: the banner never renders during SSR or the first client pass
 * (mounted starts false). Rendering it on the server would always show it
 * (no window/localStorage there), while an accepted visitor's client state
 * hides it — a guaranteed hydration mismatch that could leave a stale, dead
 * banner on screen. Mounting it only after effects run keeps SSR and client
 * consistent.
 */
export function ConsentBanner({ brandName = "our site", privacyHref = "/privacy" }: ConsentBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);

  useEffect(() => {
    const update = () => {
      setVisible(isConsentBannerVisible());
      setHasChoice(getConsentChoice() !== null);
    };
    setMounted(true);
    update();
    return subscribeConsentChange(update);
  }, []);

  if (!mounted || !visible) return null;

  return (
    <div role="region" aria-label="Analytics consent" className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-surface p-5 shadow-soft">
        <p className="text-sm text-ink">
          We use analytics to understand how {brandName} is used. Accept to allow analytics, or decline to keep them off.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => setConsentChoice("accepted")}>
            Accept analytics
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConsentChoice("rejected")}>
            Decline
          </Button>
          <Link href={privacyHref} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            Learn more
          </Link>
          {hasChoice && (
            <button
              type="button"
              onClick={closeConsentManager}
              className="text-sm font-medium text-ink-3 underline-offset-2 hover:underline"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

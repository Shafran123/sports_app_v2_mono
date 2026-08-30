"use client";

// Site Customer sign-in for the Dedicated Site header (ADR-0030): reuses the
// app's single sign-in surface (WidgetIdentity — the same email+password /
// Google / inline-registration / verification form as the venue page, checkout
// and widget), plus a signed-in state that links to /profile with logout.
// The auth context owns the session, so the header reflects sign-ins from ANY
// surface.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessInfo } from "@myslot/types";
import { Dialog, DialogContent } from "@myslot/ui";
import { CalendarDays, LogOut, User } from "lucide-react";
import { useAuth } from "@myslot/auth";
import { WidgetIdentity } from "@/features/widget/widget-identity";

export function SiteAccountPanel({ business, onDark = false }: { business: BusinessInfo; onDark?: boolean }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signedInLabel = user?.name || user?.email || "";
  const hostname = typeof window !== "undefined" ? window.location.hostname : business.id;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {/* My bookings + profile: icon-only on mobile so the header holds
            three controls on small screens; full chips from sm up. */}
        <button
          type="button"
          onClick={() => router.push("/bookings")}
          aria-label="My bookings"
          className={
            onDark
              ? "flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
              : "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-2 transition-colors hover:text-ink sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
          }
        >
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline max-w-24 truncate">My bookings</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label="Go to profile"
          className={
            onDark
              ? "flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
              : "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-2 transition-colors hover:text-ink sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
          }
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline truncate">{signedInLabel}</span>
        </button>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => void logout()}
          className={`rounded-full p-2 transition-colors ${onDark ? "text-white/70 hover:text-white" : "text-ink-3 hover:text-error"}`}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          onDark
            ? "rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
        }
      >
        Sign in
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Sign in to book" description="Sign in or create an account to book at this venue." titleClassName="font-display font-extrabold">
          <WidgetIdentity siteHostname={hostname} siteName={business.name} hideIntro onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
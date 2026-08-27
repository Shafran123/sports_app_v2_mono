"use client";

// The Dedicated Site's standalone /login page (host-aware, ADR-0029/0030):
// renders the site chrome around the same sign-up/sign-in form the site header
// dialog shows (WidgetIdentity) — the Site Customer flow, never the
// marketplace Player form. Reached when the (auth) login page resolves a live
// site hostname server-side.

import { useRouter } from "next/navigation";
import type { SiteConfig } from "@myslot/types";
import { WidgetIdentity } from "@/features/widget/widget-identity";
import { currentHostname } from "@/lib/site-host";
import { SiteChrome } from "./site-chrome";

export function SiteLoginPage({ config }: { config: SiteConfig }) {
  const router = useRouter();

  return (
    <SiteChrome config={config}>
      <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-soft animate-fade-up sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg tracking-tight text-ink font-display font-extrabold">Sign in to book</h2>
              <p className="mt-1 text-sm text-ink-2">Sign in or create an account to book at this venue.</p>
            </div>
          </div>
          <div className="mt-4">
            <WidgetIdentity
              siteHostname={currentHostname()}
              siteName={config.business.name}
              hideIntro
              onDone={() => router.push("/")}
            />
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
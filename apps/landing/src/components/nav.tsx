"use client";

import Link from "next/link";
import { BrandLockup, buttonVariants } from "@myslot/ui";
import { copy, playerAppUrl } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { useBrandName } from "@/hooks/use-brand-name";

function MobileWordmark({ brand }: { brand: string }) {
  const dotIndex = brand.lastIndexOf(".");
  if (dotIndex === -1) {
    return <span className="text-white">{brand}</span>;
  }
  return (
    <span>
      <span className="text-white">{brand.slice(0, dotIndex)}</span>
      <span className="text-white/70">{brand.slice(dotIndex)}</span>
    </span>
  );
}

export function Nav() {
  const brand = useBrandName();

  return (
    <header className="sticky top-0 z-40">
      <div className="md:hidden bg-primary px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="#" className="shrink-0 font-display text-3xl font-extrabold tracking-tight">
            <MobileWordmark brand={brand} />
          </Link>
          <a
            href="#inquire"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
            onClick={() => trackCta("nav-mobile")}
          >
            {copy.nav.mobileCta}
          </a>
        </div>
      </div>

      <div className="hidden md:flex border-b border-border bg-surface/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="#" className="shrink-0 font-display text-xl font-extrabold tracking-tight text-ink">
            <BrandLockup brand={brand} />
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            <Link href="#features" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              {copy.nav.features}
            </Link>
            <Link href="#how-it-works" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              {copy.nav.howItWorks}
            </Link>
            <a href={playerAppUrl()} className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              {copy.nav.players}
            </a>
          </nav>

          <a
            href="#inquire"
            className={buttonVariants({ variant: "primary", size: "md" })}
            onClick={() => trackCta("nav")}
          >
            {copy.nav.cta}
          </a>
        </div>
      </div>
    </header>
  );
}
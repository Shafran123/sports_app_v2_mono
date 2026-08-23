"use client";

import Link from "next/link";
import { BrandLockup, buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { useBrandName } from "@/hooks/use-brand-name";

export function Nav() {
  const brand = useBrandName();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="#" className="shrink-0 font-display text-xl font-extrabold tracking-tight text-ink">
          <BrandLockup brand={brand} />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="#features" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            {copy.nav.features}
          </Link>
          <Link href="#how-it-works" className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            {copy.nav.howItWorks}
          </Link>
        </nav>

        <a
          href="#inquire"
          className={buttonVariants({ variant: "primary", size: "md" })}
          onClick={() => trackCta("nav")}
        >
          {copy.nav.cta}
        </a>
      </div>
    </header>
  );
}
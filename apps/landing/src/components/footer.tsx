"use client";

import Link from "next/link";
import { BrandLockup } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { useBrandName } from "@/hooks/use-brand-name";

export function Footer() {
  const brand = useBrandName();

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight text-ink">
            <BrandLockup brand={brand} />
          </p>
          <p className="mt-1 text-sm text-ink-2">{copy.footer.tagline}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {copy.footer.columns.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{column.title}</p>
              <nav className="mt-2 flex flex-col gap-2 text-sm text-ink-2">
                {column.links.map((link) => (
                  <Link key={link.label} href={link.href} className="transition-colors hover:text-ink">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} {brand}
      </p>
    </footer>
  );
}
"use client";

import Link from "next/link";
import { BrandLockup } from "@myslot/ui";
import { contact, copy } from "@/lib/copy";
import { useBrandName } from "@/hooks/use-brand-name";

export function Footer() {
  const brand = useBrandName();

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_auto]">
        <div>
          <p className="font-display text-lg font-extrabold tracking-tight text-ink">
            <BrandLockup brand={brand} />
          </p>
          <p className="mt-1 text-sm text-ink-2">{copy.footer.tagline}</p>
          <address className="mt-4 space-y-1 not-italic text-sm text-ink-2">
            <p>{contact.address}</p>
            <a href={`tel:${contact.phoneHref}`} className="block transition-colors hover:text-ink">
              {contact.phone}
            </a>
            <a href={`mailto:${contact.email}`} className="block transition-colors hover:text-ink">
              {contact.email}
            </a>
          </address>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {copy.footer.columns.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{column.title}</p>
              <nav className="mt-2 flex flex-col gap-2 text-sm text-ink-2">
                {column.links.map((link) =>
                  "mailto" in link ? (
                    <a key={link.label} href={`mailto:${contact.email}`} className="transition-colors hover:text-ink">
                      {link.label}
                    </a>
                  ) : (
                    <Link key={link.label} href={link.href} className="transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  )
                )}
              </nav>
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} {brand} · {contact.address}
      </p>
    </footer>
  );
}
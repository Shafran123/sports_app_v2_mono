"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Avatar } from "@spots/ui";
import { useAuth } from "@/context/auth";
import { useUnread } from "@/hooks/use-unread";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/bookings", label: "Bookings" },
  { href: "/events", label: "Events" }
];

export function PlayerNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unread } = useUnread();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0 font-display text-xl font-extrabold tracking-tight text-ink">
          Spots<span className="text-primary">.</span>
        </Link>

        <Link
          href="/explore"
          className="press hidden h-10 flex-1 items-center gap-2 rounded-full border border-border bg-paper px-4 text-sm text-ink-3 transition-colors hover:border-primary/40 hover:text-ink-2 md:flex md:max-w-sm"
        >
          <Search className="h-4 w-4" />
          Search venues, sports…
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`press rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-primary-light font-semibold text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
            className="press relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink-2 transition-colors hover:border-primary/40"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link href={user ? "/profile" : "/login"} aria-label="Profile">
            <Avatar name={user?.name ?? "G"} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
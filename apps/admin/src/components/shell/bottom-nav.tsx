"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, LayoutDashboard, ShieldCheck, Store } from "lucide-react";
import { cn } from "@spots/utils";

const OWNER_TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/front-desk", label: "Front desk", icon: Store },
  { href: "/venues", label: "Venues", icon: Building2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays }
];

const ADMIN_TABS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin-venues", label: "Venues", icon: Building2 },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck }
];

export function ConsoleBottomNav({ role }: { role: "admin" | "venue_owner" }) {
  const pathname = usePathname();
  const tabs = role === "admin" ? ADMIN_TABS : OWNER_TABS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors",
                active
                  ? "rounded-2xl bg-primary-light text-primary"
                  : "text-ink-3 hover:text-ink-2"
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
              {tab.label}
              {active && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  X
} from "lucide-react";
import { cn } from "@myslot/utils";
import { BrandLockup } from "@myslot/ui";
import { useAuth } from "@/context/auth";
import { useBrandName } from "@/hooks/use-brand-name";

const STAFF_NAV = [
  { section: "Operations", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] }
];

const OWNER_NAV = [
  {
    section: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/front-desk", label: "Front desk", icon: StoreIcon },
      { href: "/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/venues", label: "Venues", icon: Building2 },
      { href: "/widget-and-site", label: "Widget & site", icon: Globe },
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/events", label: "Events", icon: Ticket },
      { href: "/plan", label: "Plan & agreement", icon: FileText }
    ]
  }
];

const ADMIN_NAV = [
  {
    section: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/bookings", label: "Bookings", icon: CalendarDays }
    ]
  },
  {
    section: "Platform",
    items: [
      { href: "/approvals", label: "Venue approvals", icon: ShieldCheck },
      { href: "/admin-venues", label: "Venues", icon: Building2 },
      { href: "/leads", label: "Leads", icon: Inbox },
      { href: "/owners", label: "Owners", icon: StoreIcon },
      { href: "/sites", label: "Sites", icon: Globe },
      { href: "/events", label: "Events", icon: Ticket },
      { href: "/sports", label: "Sports", icon: Trophy },
      { href: "/players", label: "Players", icon: Users },
      { href: "/settings", label: "Settings & reports", icon: Settings }
    ]
  }
];

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M4 12v8h16v-8M9 20v-5h6v5" />
    </svg>
  );
}

export function AdminSidebar({ role }: { role: "admin" | "venue_owner" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const brand = useBrandName();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = role === "admin" ? ADMIN_NAV : OWNER_NAV;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight text-ink">
            <BrandLockup brand={brand} />
            <span className="ml-1.5 align-middle text-xs font-semibold text-ink-3">Console</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {nav.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-primary-light text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          {user && (
            <div className="mb-2 flex items-center gap-3 px-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                {(user.name || user.email || "?")[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user.name || user.email}</p>
                <p className="truncate text-xs capitalize text-ink-3">{user.role.replace("_", " ")}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-error-light hover:text-error"
          >
            <LogOut className="h-[18px] w-[18px]" /> Log out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="font-display font-extrabold tracking-tight text-ink">
          <BrandLockup brand={brand} />
        </p>
      </header>
    </>
  );
}

export function useAuthPublic() {
  return useAuth();
}
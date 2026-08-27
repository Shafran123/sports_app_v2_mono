"use client";

import { RequireStaff, RequireOnboarded, useAuth } from "@/context/auth";
import { AdminSidebar } from "@/components/shell/sidebar";
import { ConsoleBottomNav } from "@/components/shell/bottom-nav";
import { RealtimeBridge } from "@/hooks/use-realtime";
import { usePathname } from "next/navigation";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const role = user?.role === "admin" ? "admin" : "venue_owner";
  const isAdmin = user?.role === "admin";
  const isPlanPage = pathname === "/plan";

  return (
    <RequireStaff>
      <RealtimeBridge>
        {isAdmin || isPlanPage ? (
          <>
            <div className="min-h-screen bg-paper text-ink lg:pl-64">
              <AdminSidebar role={role} />
              <main className="px-5 pb-28 pt-5 md:pb-12 lg:px-8 lg:pt-8">{children}</main>
            </div>
            <ConsoleBottomNav role={role} />
          </>
        ) : (
          <RequireOnboarded>
            <div className="min-h-screen bg-paper text-ink lg:pl-64">
              <AdminSidebar role={role} />
              <main className="px-5 pb-28 pt-5 md:pb-12 lg:px-8 lg:pt-8">{children}</main>
            </div>
            <ConsoleBottomNav role={role} />
          </RequireOnboarded>
        )}
      </RealtimeBridge>
    </RequireStaff>
  );
}
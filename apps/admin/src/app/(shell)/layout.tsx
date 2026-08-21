"use client";

import { RequireStaff, useAuth } from "@/context/auth";
import { AdminSidebar } from "@/components/shell/sidebar";
import { ConsoleBottomNav } from "@/components/shell/bottom-nav";
import { RealtimeBridge } from "@/hooks/use-realtime";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role === "admin" ? "admin" : "venue_owner";

  return (
    <RequireStaff>
      <RealtimeBridge />
      <div className="min-h-screen bg-paper text-ink lg:pl-64">
        <AdminSidebar role={role} />
        {children}
      </div>
      <ConsoleBottomNav role={role} />
    </RequireStaff>
  );
}
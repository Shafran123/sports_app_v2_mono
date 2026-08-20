"use client";

import { RequireStaff, useAuth } from "@/context/auth";
import { AdminSidebar } from "@/components/shell/sidebar";

export default function VenuesLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <RequireStaff>
      <div className="min-h-screen bg-paper text-ink lg:pl-64">
        <AdminSidebar role={user?.role === "admin" ? "admin" : "venue_owner"} />
        {children}
      </div>
    </RequireStaff>
  );
}
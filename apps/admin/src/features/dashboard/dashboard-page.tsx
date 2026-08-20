"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ShieldCheck, Wallet } from "lucide-react";
import { StatCard, EmptyState, Button } from "@spots/ui";
import { formatLkr } from "@spots/utils";
import { business, admin } from "@spots/api";
import { useAuth } from "@/context/auth";

export function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const isAdmin = user?.role === "admin";

  const { data: overview, isLoading, isError, refetch } = useQuery({
    queryKey: ["business-overview", today],
    queryFn: () => business.overview(today),
    enabled: !!user && !isAdmin
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["admin-pending-count"],
    queryFn: async () => (await admin.pendingVenues()).length,
    enabled: !!user && isAdmin
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-2">
          {isAdmin ? "Platform overview" : "Your venues at a glance"}
        </p>
      </div>

      {isAdmin ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Pending approvals"
              value={pendingCount ?? "—"}
              icon={ShieldCheck}
              changeLabel="venues awaiting review"
            />
            <StatCard title="Revenue today" value={formatLkr(overview?.revenue ?? 0)} icon={Wallet} />
            <StatCard title="Bookings today" value={overview?.bookings_count ?? 0} icon={CalendarDays} />
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">Admin console</h2>
                <p className="mt-1 text-sm text-ink-2">
                  Review venue submissions and manage platform content.
                </p>
              </div>
              <Button onClick={() => router.push("/approvals")}>Open approvals</Button>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-32 rounded-3xl" />
          ))}
        </div>
      ) : isError || !overview ? (
        <EmptyState
          title="Could not load the dashboard"
          message="We could not load your overview right now."
          actionLabel="Try again"
          onAction={() => refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Bookings today" value={overview.bookings_count} icon={CalendarDays} />
          <StatCard title="Revenue today" value={formatLkr(overview.revenue)} icon={Wallet} />
          <StatCard title="This month" value={formatLkr(overview.month_revenue)} icon={Building2} />
        </div>
      )}
    </div>
  );
}

function StatusCard({ title, value, icon }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  const Icon = icon;
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink-2">{title}</p>
          <p className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
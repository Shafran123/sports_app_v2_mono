"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ShieldCheck, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard, EmptyState, Button, Card } from "@myslot/ui";
import { formatLkr } from "@myslot/utils";
import { business, admin, venues } from "@myslot/api";
import { useAuth } from "@/context/auth";
import type { OwnerReports } from "@myslot/types";

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

  const { data: adminOverview, isLoading: adminLoading, isError: adminError, refetch: refetchAdmin } = useQuery({
    queryKey: ["admin-overview", today],
    queryFn: () => admin.overview(),
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
        adminLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-32 rounded-3xl" />
            ))}
          </div>
        ) : adminError || !adminOverview ? (
          <EmptyState
            title="Could not load the platform overview"
            message="We could not load the admin numbers right now."
            actionLabel="Try again"
            onAction={() => refetchAdmin()}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Revenue today" value={formatLkr(adminOverview.revenue_today)} icon={Wallet} />
              <StatCard title="Bookings today" value={adminOverview.bookings_today} icon={CalendarDays} />
              <StatCard title="Total venues" value={adminOverview.total_venues} icon={Building2} />
              <StatCard title="Pending approvals" value={adminOverview.pending_approvals} icon={ShieldCheck} changeLabel="venues awaiting review" />
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
        )
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
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Bookings today" value={overview.bookings_count} icon={CalendarDays} />
            <StatCard title="Revenue today" value={formatLkr(overview.revenue)} icon={Wallet} />
            <StatCard title="This month" value={formatLkr(overview.month_revenue)} icon={Building2} />
          </div>
          <OwnerDashboard />
        </div>
      )}
    </div>
  );
}

function OwnerDashboard() {
  const router = useRouter();
  const [range, setRange] = React.useState<7 | 30 | 90>(7);
  const [venueId, setVenueId] = React.useState("all");

  const { data: venuesList } = useQuery({
    queryKey: ["admin-venues-mine"],
    queryFn: () => venues.mine()
  });

  const { data: reports, isError, isLoading, refetch } = useQuery({
    queryKey: ["business-reports", range, venueId],
    queryFn: () => business.reports({ range, venue_id: venueId === "all" ? undefined : venueId })
  });

  const myVenues = venuesList ?? [];

  if (myVenues.length === 0) {
    return (
      <EmptyState
        title="Create your first venue"
        message="List your venue to start taking bookings and see your reports here."
        actionLabel="Create a venue"
        onAction={() => router.push("/venues/new")}
      />
    );
  }

  if (isLoading) {
    return <Card className="p-6"><div className="skeleton h-64 rounded-2xl" /></Card>;
  }
  if (isError || !reports) {
    return (
      <EmptyState
        title="Could not load your reports"
        message="The report data is unavailable right now."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Revenue is net of tax; your venue tax is reported separately.</p>
        <div className="flex items-center gap-2">
          {myVenues.length > 1 && (
            <select
              aria-label="Venue filter"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-44 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="all">All venues</option>
              {myVenues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}
          <select
            aria-label="Report range"
            value={String(range)}
            onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}
            className="w-40 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>
      <OwnerReportCharts data={reports} />
    </div>
  );
}

function OwnerReportCharts({ data }: { data: OwnerReports }) {
  const summary = data.series.reduce(
    (acc, d) => ({ revenue: acc.revenue + d.revenue, tax: acc.tax + (d.tax ?? 0), venueTax: acc.venueTax + (d.venue_tax ?? 0), bookings: acc.bookings + d.bookings }),
    { revenue: 0, tax: 0, venueTax: 0, bookings: 0 }
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Revenue &amp; tax</p>
        <p className="text-xs text-ink-2">
          Net revenue {formatLkr(summary.revenue)} • platform tax {formatLkr(summary.tax)} • venue tax {formatLkr(summary.venueTax)} • {summary.bookings} paid bookings
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => (typeof v === "number" ? formatLkr(v) : String(v))} />
            <Legend />
            <Bar dataKey="revenue" name="Net revenue" fill="#176036" radius={[4, 4, 0, 0]} />
            <Bar dataKey="venue_tax" name="Venue tax" fill="#d97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Bookings per day</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#176036" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Bookings by sport</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.by_sport} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="revenue" name="Net revenue" fill="#176036" radius={[0, 4, 4, 0]} />
            <Bar dataKey="bookings" name="Bookings" fill="#94a3b8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Online vs cash (net revenue)</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={[
                { name: "PayHere", value: data.payment_split.payhere?.revenue ?? 0, fill: "#176036" },
                { name: "Cash", value: data.payment_split.cash.revenue, fill: "#d97706" }
              ]}
              dataKey="value"
              nameKey="name"
              label={(e) => e.name as string}
            />
            <Tooltip formatter={(v) => (typeof v === "number" ? formatLkr(v) : String(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
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
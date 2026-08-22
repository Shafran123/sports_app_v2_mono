"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { admin, toApiFailure } from "@spots/api";
import { Button, Card, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@spots/ui";
import { formatLkr } from "@spots/utils";
import type { AdminConfig, AdminReports, FeatureFlagDef } from "@spots/types";

export function SettingsPage() {
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-config"],
    queryFn: () => admin.platformConfig()
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Settings & reports</h1>
        <p className="mt-1 text-sm text-ink-2">Feature flags, tax configuration, reporting, and change audit.</p>
      </div>

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags">Feature flags</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="mt-5">
          {isLoading ? (
            <Card className="p-6"><div className="skeleton h-24 rounded-2xl" /></Card>
          ) : isError || !data ? (
            <PanelError onRetry={() => refetch()} />
          ) : (
            <FlagsPanel config={data} />
          )}
        </TabsContent>

        <TabsContent value="tax" className="mt-5">
          {isLoading ? (
            <Card className="p-6"><div className="skeleton h-24 rounded-2xl" /></Card>
          ) : isError || !data ? (
            <PanelError onRetry={() => refetch()} />
          ) : (
            <TaxPanel config={data} />
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-5">
          <ReportsPanel />
        </TabsContent>

        <TabsContent value="audit" className="mt-5">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Could not load settings"
      message="The platform configuration is unavailable right now."
      actionLabel="Try again"
      onAction={onRetry}
    />
  );
}

function FlagsPanel({ config }: { config: AdminConfig }) {
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const set = useMutation({
    mutationFn: (input: { key: string; value: unknown }) => admin.setConfigKey(input.key, input.value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-config"] }),
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not save this flag.")
  });

  const setFlag = (flag: FeatureFlagDef, value: unknown) => {
    setError(null);
    set.mutate({ key: flag.name, value });
  };

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-ink">Feature flags</h2>
      <p className="mt-1 text-sm text-ink-2">Changes apply immediately — gates are read live from the backend.</p>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}
      <ul className="mt-5 divide-y divide-border">
        {config.flags.map((flag) => (
          <li key={flag.name} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-ink">{flag.name}</p>
              <p className="mt-0.5 max-w-xl text-sm text-ink-2">{flag.description}</p>
              {flag.type === "enum" && <p className="mt-1 text-xs text-ink-3">States: {flag.values?.join(" / ")}</p>}
            </div>
            {flag.type === "boolean" ? (
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-sm text-ink-2">{flag.value ? "On" : "Off"}</span>
                <input
                  type="checkbox"
                  checked={Boolean(flag.value)}
                  onChange={(e) => setFlag(flag, e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
              </label>
            ) : (
              <select
                aria-label={`${flag.name} state`}
                value={String(flag.value ?? flag.default)}
                onChange={(e) => setFlag(flag, e.target.value)}
                className="w-44 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
              >
                {flag.values?.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TaxPanel({ config }: { config: AdminConfig }) {
  const qc = useQueryClient();
  const [rate, setRate] = React.useState(String(config.tax_rate));
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const save = useMutation({
    mutationFn: () => admin.setConfigKey("tax_rate", Number(rate)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-config"] });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not save the tax rate.")
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-ink">Tax configuration</h2>
      <p className="mt-1 text-sm text-ink-2">
        A single platform-wide rate added on top of booking &amp; event prices at checkout. Revenue is reported net of
        tax; a zero rate shows &ldquo;Tax not applicable&rdquo;.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          aria-label="Tax rate percentage"
          type="number"
          min={0}
          max={100}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-32 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
        />
        <span className="text-sm text-ink-2">%</span>
        <Button variant="primary" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save rate"}
        </Button>
        {saved && <span className="text-sm text-success">Saved — new bookings will use this rate.</span>}
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}
    </Card>
  );
}

function ReportsPanel() {
  const [range, setRange] = React.useState<7 | 30 | 90>(7);
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-reports", range],
    queryFn: () => admin.reports(range)
  });

  if (isLoading) {
    return <Card className="p-6"><div className="skeleton h-64 rounded-2xl" /></Card>;
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load reports"
        message="The report data is unavailable right now."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Revenue is net of tax; tax is reported separately.</p>
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
      <ReportCharts data={data} />
    </div>
  );
}

function ReportCharts({ data }: { data: AdminReports }) {
  const summary = data.series.reduce(
    (acc, d) => ({ revenue: acc.revenue + d.revenue, tax: acc.tax + d.tax, bookings: acc.bookings + d.bookings }),
    { revenue: 0, tax: 0, bookings: 0 }
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Revenue &amp; tax</p>
        <p className="text-xs text-ink-2">
          Net revenue {formatLkr(summary.revenue)} • tax {formatLkr(summary.tax)} • {summary.bookings} paid bookings
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => (typeof v === "number" ? formatLkr(v) : String(v))} />
            <Legend />
            <Bar dataKey="revenue" name="Net revenue" fill="#176036" radius={[4, 4, 0, 0]} />
            <Bar dataKey="tax" name="Tax" fill="#d97706" radius={[4, 4, 0, 0]} />
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
                { name: "Online", value: data.payment_split.online.revenue, fill: "#176036" },
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
        <p className="text-sm text-ink-2">
          Events: {data.events.registrations} registrations • {formatLkr(data.events.revenue)}
        </p>
      </Card>
    </div>
  );
}

function AuditPanel() {
  const { data, isError, isPending, refetch } = useQuery({
    queryKey: ["admin-config-audit"],
    queryFn: () => admin.configAudit()
  });

  if (isPending) {
    return <Card className="p-6"><div className="skeleton h-48 rounded-2xl" /></Card>;
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load audit log"
        message="The audit trail is unavailable right now."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }
  if (data.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-2">No configuration changes recorded yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto rounded-3xl p-0">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-ink-2">
            <th className="px-4 py-3 font-medium">Key</th>
            <th className="px-4 py-3 font-medium">Changed by</th>
            <th className="px-4 py-3 font-medium">Old value</th>
            <th className="px-4 py-3 font-medium">New value</th>
            <th className="px-4 py-3 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{row.key}</td>
              <td className="px-4 py-3 text-ink-2">{row.admin_name ?? row.admin_email ?? "system"}</td>
              <td className="px-4 py-3 text-ink-2">{String(row.old_value ?? "—")}</td>
              <td className="px-4 py-3 text-ink">{String(row.new_value)}</td>
              <td className="px-4 py-3 text-ink-2">{new Date(row.changed_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
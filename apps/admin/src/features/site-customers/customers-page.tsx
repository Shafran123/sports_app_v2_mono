"use client";

// Owner Console Customers directory (ADR-0030): the Business's Site
// Customers — its own audience asset. Name/email/phone, joined, bookings,
// total spend, last booking; searchable and CSV-exportable. Data is strictly
// per-Business (the API scopes it server-side).

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, toApiFailure } from "@myslot/api";
import { Badge, Button, Dialog, DialogContent, ErrorState, Input, SkeletonCard } from "@myslot/ui";
import { formatLkr } from "@myslot/utils";
import { Download, KeyRound, Search } from "lucide-react";
import type { SiteCustomerSummary } from "@myslot/types";

function isoDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CustomersPage() {
  const [q, setQ] = useState("");
  const [resetting, setResetting] = useState<SiteCustomerSummary | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["business-customers"],
    queryFn: () => business.customers(),
    staleTime: 30_000
  });

  const resetFactor = useMutation({
    mutationFn: () => business.resetCustomerFactor(resetting!.id),
    onSuccess: () => {
      setResetting(null);
      void queryClient.invalidateQueries({ queryKey: ["business-customers"] });
    }
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) =>
      [c.name, c.email, c.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [query.data, q]);

  const exportCsv = () => {
    const header = "name,email,phone,joined,bookings,total_spend,last_booking";
    const lines = rows.map((c) =>
      [c.name ?? "", c.email, c.phone ?? "", c.joined_at, c.booking_count, c.total_spend, c.last_booking_at ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-ink-2">
            The people who book on your dedicated site — your own audience, kept per business.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-64 pl-9"
              aria-label="Search customers"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} className="h-16" />)}
        </div>
      ) : query.isError || !query.data ? (
        <ErrorState title="Could not load your customers" message={toApiFailure(query.error).message} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface-2 p-10 text-center text-sm text-ink-3">
          {q ? "No customers match your search." : "No customers yet — people who sign up and book on your site will appear here."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-3">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3 font-semibold">Bookings</th>
                <th className="px-5 py-3 font-semibold">Total spend</th>
                <th className="px-5 py-3 font-semibold">Last booking</th>
                <th className="px-5 py-3 font-semibold">Second factor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c: SiteCustomerSummary) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-ink">{c.name || "—"}</p>
                    <p className="text-xs text-ink-2">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{isoDate(c.joined_at)}</td>
                  <td className="px-5 py-3 text-ink">
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">{c.booking_count}</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-ink">{c.total_spend > 0 ? formatLkr(c.total_spend) : "—"}</td>
                  <td className="px-5 py-3 text-ink-2">{isoDate(c.last_booking_at)}</td>
                  <td className="px-5 py-3">
                    {c.totp_enabled_at ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="success">
                          <KeyRound className="h-3 w-3" /> On
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => setResetting(c)} className="text-error hover:bg-error-light hover:text-error">
                          Reset
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent
          title="Reset two-factor authentication?"
          description="The customer will be signed out everywhere and can sign in again without the app code."
        >
          {resetting && (
            <div className="space-y-3">
              {resetFactor.isError && (
                <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{toApiFailure(resetFactor.error).message}</p>
              )}
              <p className="text-sm text-ink-2">
                Resetting <span className="font-semibold text-ink">{resetting.name || resetting.email}</span>&apos;s
                factor lets them back in without their authenticator app. Their backup codes stop
                working too.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setResetting(null)}>Cancel</Button>
                <Button variant="destructive" loading={resetFactor.isPending} onClick={() => resetFactor.mutate()}>
                  Reset factor
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
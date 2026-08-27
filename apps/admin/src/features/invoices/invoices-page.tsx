"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { business } from "@myslot/api";
import type { Invoice } from "@myslot/types";
import { buttonVariants, Button, Card, EmptyState, ErrorState, Input, Table, TableBody, TableHead, TableRow, Th, Td } from "@myslot/ui";
import { SkeletonRow } from "@myslot/ui";
import { addDaysKey, cn, dayLabel, formatLkr, formatTime12, toDateKey } from "@myslot/utils";

function invoiceNo(invoice: Invoice): string {
  return invoice.invoice_number ? `INV-${String(invoice.invoice_number).padStart(4, "0")}` : "—";
}

function paymentLabel(invoice: Invoice): string {
  if (invoice.payment_method !== "cash") return "Paid online";
  return invoice.payment_status === "paid" ? "Cash — Paid" : "Cash — Due";
}

export function InvoicesPage() {
  const todayKey = toDateKey(new Date());
  const [fromKey, setFromKey] = useState(addDaysKey(todayKey, -30));
  const [toKey, setToKey] = useState(todayKey);
  const [busyId, setBusyId] = useState<string | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ["owner-invoices", fromKey, toKey],
    queryFn: () => business.invoices({ from: `${fromKey}T00:00:00`, to: `${toKey}T23:59:59` })
  });

  const rows = invoicesQuery.data ?? [];
  const due = rows.filter((r) => r.payment_method === "cash" && r.payment_status !== "paid").length;

  async function download(id: string) {
    setBusyId(id);
    try {
      const win = window.open("about:blank", "_blank");
      if (!win) return;
      const blob = await business.bookingBillPdf(id);
      win.location.replace(URL.createObjectURL(blob));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Invoices</h1>
        <p className="mt-1 text-sm text-ink-2">
          {rows.length} bill{rows.length === 1 ? "" : "s"} · {due} due
        </p>
      </div>

      <Card className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:w-44">
          <label htmlFor="invoices-from" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            From
          </label>
          <Input id="invoices-from" type="date" value={fromKey} onChange={(e) => setFromKey(e.target.value)} />
        </div>
        <div className="w-full space-y-1.5 sm:w-44">
          <label htmlFor="invoices-to" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            To
          </label>
          <Input id="invoices-to" type="date" value={toKey} onChange={(e) => setToKey(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setFromKey(addDaysKey(todayKey, -30));
            setToKey(todayKey);
          }}
        >
          Last 30 days
        </Button>
      </Card>

      {invoicesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : invoicesQuery.isError ? (
        <ErrorState
          title="Could not load invoices"
          message="Something went wrong while fetching your bills. Please try again."
          onRetry={() => invoicesQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No invoices" message="No bookings in this window yet." />
      ) : (
        <Table>
          <TableHead>
            <Th>Invoice</Th>
            <Th>Player</Th>
            <Th>Booking</Th>
            <Th>Date</Th>
            <Th>Payment</Th>
            <Th>Total</Th>
            <Th className="text-right">Bill</Th>
          </TableHead>
          <TableBody>
            {rows.map((invoice) => (
              <TableRow key={invoice.id}>
                <Td className="font-mono text-xs text-ink">{invoiceNo(invoice)}</Td>
                <Td className="font-medium text-ink">{invoice.player_name ?? "Walk-in"}</Td>
                <Td>
                  {invoice.venue_name ?? invoice.court_name}
                  <span className="text-ink-3"> · {invoice.court_name}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {dayLabel(invoice.start_at)} · {formatTime12(invoice.start_at)}–{formatTime12(invoice.end_at)}
                </Td>
                <Td>
                  <span className="text-sm text-ink-2">{paymentLabel(invoice)}</span>
                </Td>
                <Td className="font-display font-extrabold text-ink">{formatLkr(invoice.total_price)}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    disabled={busyId === invoice.id}
                    onClick={() => download(invoice.id)}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { business, venues } from "@myslot/api";
import { buttonVariants, Card, EmptyState, ErrorState, Input, SelectSheet, StatusPill, Table, TableBody, TableHead, TableRow, Th, Td } from "@myslot/ui";
import { SkeletonRow } from "@myslot/ui";
import { cn, formatLkr, formatTime12, toDateKey } from "@myslot/utils";
import { useAuth } from "@/context/auth";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" }
];

export function BookingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === "venue_owner";
  const todayKey = toDateKey(new Date());

  const [dateKey, setDateKey] = useState(todayKey);
  const [venueFilter, setVenueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const venuesQuery = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => venues.mine(),
    enabled: isOwner
  });

  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings", dateKey],
    queryFn: () => business.listBookings({ date: dateKey })
  });

  const rows = bookingsQuery.data ?? [];
  const filtered = useMemo(
    () =>
      rows.filter((b) => {
        if (statusFilter !== "all" && b.status !== statusFilter) return false;
        if (venueFilter !== "all" && b.venue_name !== venueFilter) return false;
        return true;
      }),
    [rows, statusFilter, venueFilter]
  );

  const openDetail = (id: string) => router.push(`/bookings/${id}`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Bookings</h1>
        <p className="mt-1 text-sm text-ink-2">
          {filtered.length} of {rows.length} bookings for this day
        </p>
      </div>

      <Card className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:w-44">
          <label htmlFor="bookings-date" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Date
          </label>
          <Input id="bookings-date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
        </div>
        {isOwner && venuesQuery.data && venuesQuery.data.length > 0 && (
          <div className="w-full space-y-1.5 sm:w-56">
            <label htmlFor="bookings-venue" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Venue
            </label>
            <SelectSheet
              id="bookings-venue"
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="w-full"
            >
              <option value="all">All venues</option>
              {venuesQuery.data.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </SelectSheet>
          </div>
        )}
        <div className="w-full space-y-1.5 sm:w-52">
          <label htmlFor="bookings-status" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Status
          </label>
          <SelectSheet
            id="bookings-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectSheet>
        </div>
      </Card>

      {bookingsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : bookingsQuery.isError ? (
        <ErrorState
          title="Could not load bookings"
          message="Something went wrong while fetching bookings. Please try again."
          onRetry={() => bookingsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No bookings for this day"
          message="New bookings placed for this date will appear here."
        />
      ) : (
        <>
          <Table className="hidden md:block">
            <TableHead>
              <Th>Booking</Th>
              <Th>Customer</Th>
              <Th>Court</Th>
              <Th>Time range</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </TableHead>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id} onClick={() => openDetail(b.id)}>
                  <Td className="font-mono text-xs text-ink">#{b.id.slice(0, 8)}</Td>
                  <Td className="font-medium text-ink">{b.player_name ?? "Guest"}</Td>
                  <Td>{b.court_name}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatTime12(b.start_at)}–{formatTime12(b.end_at)}
                  </Td>
                  <Td className="font-display font-extrabold text-ink">{formatLkr(b.total_price)}</Td>
                  <Td>
                    <StatusPill status={b.status} />
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(b.id);
                      }}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                    >
                      View
                    </button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-3 md:hidden">
            {filtered.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{b.venue_name ?? b.court_name}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-2">{b.player_name ?? "Guest"}</p>
                  </div>
                  <StatusPill status={b.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="whitespace-nowrap text-sm tabular-nums text-ink-2">
                    {formatTime12(b.start_at)}–{formatTime12(b.end_at)}
                  </p>
                  <span className="font-display text-lg font-extrabold text-ink">{formatLkr(b.total_price)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-3">#{b.id.slice(0, 8)}</span>
                  <button
                    type="button"
                    onClick={() => openDetail(b.id)}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    View
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
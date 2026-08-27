"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { business, venues, sports } from "@myslot/api";
import { buttonVariants, Button, Card, EmptyState, ErrorState, Input, SelectSheet, StatusPill, Table, TableBody, TableHead, TableRow, Th, Td } from "@myslot/ui";
import { SkeletonRow } from "@myslot/ui";
import { cn, dayLabel, formatLkr, formatTime12, toDateKey } from "@myslot/utils";
import { useAuth } from "@/context/auth";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled (legacy)" },
  { value: "cancelled_by_user", label: "Cancelled by user" },
  { value: "cancelled_by_owner", label: "Cancelled by venue" },
  { value: "cancelled_by_admin", label: "Cancelled by admin" },
  { value: "cancelled_auto", label: "Auto-cancelled" },
  { value: "no_show", label: "No-show" }
];

export function BookingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === "venue_owner";
  const todayKey = toDateKey(new Date());

  const [dateKey, setDateKey] = useState(todayKey);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [venueFilter, setVenueFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [page, setPage] = useState(1);

  const venuesQuery = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => venues.mine(),
    enabled: isOwner
  });

  const sportsQuery = useQuery({
    queryKey: ["admin-sports"],
    queryFn: () => sports.list(),
    enabled: isOwner
  });

  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings", dateKey, dateFrom, dateTo, venueFilter, statusFilter, sportFilter, page],
    queryFn: () =>
      business.listBookings({
        date: !isOwner ? dateKey : undefined,
        date_from: isOwner && dateFrom ? dateFrom : undefined,
        date_to: isOwner && dateTo ? dateTo : undefined,
        venue_id: isOwner && venueFilter !== "all" ? venueFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        sport: isOwner && sportFilter !== "all" ? sportFilter : undefined,
        page,
        limit: 25
      })
  });

  const rows = bookingsQuery.data?.data ?? [];
  const total = bookingsQuery.data?.meta.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const openDetail = (id: string) => router.push(`/bookings/${id}`);

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setVenueFilter("all");
    setStatusFilter("all");
    setSportFilter("all");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Bookings</h1>
        <p className="mt-1 text-sm text-ink-2">
          {total} booking{total === 1 ? "" : "s"} matching your filters
        </p>
      </div>

      <Card className="flex flex-col gap-2.5 p-4 lg:flex-row lg:items-end">
        {!isOwner ? (
          <div className="w-full space-y-1.5 sm:w-44">
            <label htmlFor="bookings-date" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Date
            </label>
            <Input id="bookings-date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="w-full space-y-1.5 sm:w-44">
              <label htmlFor="bookings-from" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                From
              </label>
              <Input id="bookings-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="w-full space-y-1.5 sm:w-44">
              <label htmlFor="bookings-to" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                To
              </label>
              <Input id="bookings-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </>
        )}
        {isOwner && venuesQuery.data && venuesQuery.data.length > 0 && (
          <div className="w-full space-y-1.5 sm:w-52">
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
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </SelectSheet>
          </div>
        )}
        {isOwner && (
          <div className="w-full space-y-1.5 sm:w-44">
            <label htmlFor="bookings-sport" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Sport
            </label>
            <SelectSheet id="bookings-sport" value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} className="w-full">
              <option value="all">All sports</option>
              {(sportsQuery.data ?? []).map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </SelectSheet>
          </div>
        )}
        <div className="w-full space-y-1.5 sm:w-48">
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
        <Button variant="secondary" size="sm" onClick={resetFilters} className="shrink-0">
          Reset filters
        </Button>
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
      ) : rows.length === 0 ? (
        <EmptyState
          title="No bookings match"
          message="Try widening your date range or clearing filters."
        />
      ) : (
        <>
          <Table className="hidden md:block">
            <TableHead>
              <Th>Booking</Th>
              <Th>Customer</Th>
              <Th>Court</Th>
              <Th>Date</Th>
              <Th>Time range</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </TableHead>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} onClick={() => openDetail(b.id)}>
                  <Td className="font-mono text-xs text-ink">#{b.id.slice(0, 8)}</Td>
                  <Td className="font-medium text-ink">{b.player_name ?? "Guest"}</Td>
                  <Td>{b.court_name}</Td>
                  <Td className="whitespace-nowrap">{dayLabel(b.start_at)}</Td>
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
            {rows.map((b) => (
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
                    {dayLabel(b.start_at)} · {formatTime12(b.start_at)}–{formatTime12(b.end_at)}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-sm text-ink-2">
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
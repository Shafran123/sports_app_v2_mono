"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, QrCode, UserPlus } from "lucide-react";
import { business, venues } from "@myslot/api";
import { Badge, Button, EmptyState, Skeleton, StatusPill } from "@myslot/ui";
import { dayLabel, formatDateLong, formatTime12, toDateKey } from "@myslot/utils";
import type { Booking } from "@myslot/types";
import { BookingDetailDialog } from "@/features/admin-calendar/booking-detail-dialog";
import { QrScanDialog } from "./qr-scan-dialog";
import { QuickBookDialog } from "./quick-book-dialog";

export function FrontDeskPage() {
  const todayKey = toDateKey(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [quickBookOpen, setQuickBookOpen] = useState(false);

  const venuesQuery = useQuery({ queryKey: ["front-desk-venues"], queryFn: () => venues.mine() });
  const venuesList = venuesQuery.data ?? [];

  const bookingsQuery = useQuery({
    queryKey: ["front-desk-bookings", todayKey],
    queryFn: () => business.listBookings({ date: todayKey })
  });

  const todayBookings = useMemo(() => {
    const list = bookingsQuery.data ?? [];
    return [...list].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [bookingsQuery.data]);

  // Derive the selected booking from the live list so an action (check-in,
  // mark paid, no-show) refreshes the sheet in place instead of showing the
  // stale snapshot captured at open time.
  const selectedBooking = useMemo(
    () => todayBookings.find((b) => b.id === selectedId) ?? null,
    [todayBookings, selectedId]
  );

  const upcoming = todayBookings.filter((b) => b.status === "confirmed" || b.status === "checked_in");
  const past = todayBookings.filter((b) => !["confirmed", "checked_in"].includes(b.status));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Front desk</h1>
          <p className="mt-1 text-sm text-ink-2">{formatDateLong(new Date().toISOString())}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setScanOpen(true)}>
            <QrCode className="h-4 w-4" /> Scan QR
          </Button>
          <Button onClick={() => setQuickBookOpen(true)}>
            <UserPlus className="h-4 w-4" /> Quick book
          </Button>
        </div>
      </div>

      {bookingsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : bookingsQuery.isError ? (
        <EmptyState title="Could not load today's bookings" message="Please try again." />
      ) : todayBookings.length === 0 ? (
        <EmptyState
          title="No bookings today"
          message="Use Quick book to add a walk-in, or wait for online bookings to arrive."
        />
      ) : (
        <div className="space-y-2">
          {upcoming.map((b) => (
            <BookingRow key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />
          ))}
          {past.length > 0 && (
            <div className="pt-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Earlier / finished</p>
              <div className="mt-2 space-y-2 opacity-70">
                {past.map((b) => (
                  <BookingRow key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <BookingDetailDialog
        open={!!selectedBooking}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
        venueName={undefined}
        court={null}
        slot={null}
        booking={selectedBooking}
      />

      <QrScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <QuickBookDialog open={quickBookOpen} onOpenChange={setQuickBookOpen} venues={venuesList} />
    </div>
  );
}

function BookingRow({ booking, onClick }: { booking: Booking; onClick: () => void }) {
  const isCash = booking.payment_method === "cash";
  const cashPaid = isCash && !!booking.paid_at;
  const player = booking.player_name || "Guest";
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex w-full items-center gap-4 rounded-3xl border border-border bg-surface p-4 text-left shadow-soft"
    >
      <div className="w-20 shrink-0 text-center">
        <p className="font-display text-lg font-extrabold text-ink">{formatTime12(booking.start_at)}</p>
        <p className="text-xs text-ink-3">{booking.court_name}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{player}</p>
        <p className="truncate text-sm text-ink-2">
          {booking.venue_name} · {formatTime12(booking.start_at)}–{formatTime12(booking.end_at)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusPill status={booking.status} />
          <Badge variant="neutral" className="border-primary/40 bg-primary-light text-primary">
            {dayLabel(booking.start_at)}
          </Badge>
          {isCash && (
            <Badge variant={cashPaid ? "success" : "warning"}>
              <Banknote className="h-3 w-3" /> {cashPaid ? "Paid" : "Cash due"}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
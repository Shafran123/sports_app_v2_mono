"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, QrCode, UserPlus } from "lucide-react";
import { business, venues } from "@myslot/api";
import { Badge, Button, EmptyState, Skeleton, StatusPill } from "@myslot/ui";
import { addDaysKey, cn, dayjs, formatDateLong, formatTime12, toDateKey } from "@myslot/utils";
import type { Booking } from "@myslot/types";
import { BookingDetailDialog } from "@/features/admin-calendar/booking-detail-dialog";
import { QrScanDialog } from "./qr-scan-dialog";
import { QuickBookDialog } from "./quick-book-dialog";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday of this week (offset 0) or next week (1), as a YYYY-MM-DD key. */
function mondayKey(weekOffset: number): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  return toDateKey(monday);
}

/** "18 – 24 Aug 2026", or "31 Aug – 6 Sep 2026" across a month boundary. */
function weekRangeLabel(monday: string, sunday: string): string {
  const from = dayjs(monday, "YYYY-MM-DD");
  const to = dayjs(sunday, "YYYY-MM-DD");
  if (from.month() === to.month() && from.year() === to.year()) {
    return `${from.format("D")} – ${to.format("D MMM YYYY")}`;
  }
  return `${from.format("D MMM")} – ${to.format("D MMM YYYY")}`;
}

export function FrontDeskPage() {
  const todayKey = toDateKey(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [quickBookOpen, setQuickBookOpen] = useState(false);

  const monday = mondayKey(weekOffset);
  const sunday = addDaysKey(monday, 6);
  const fromKey = dayKey ?? monday;
  const toKey = dayKey ?? sunday;

  const rangeLabel = useMemo(() => {
    if (dayKey) return formatDateLong(`${dayKey}T12:00:00`);
    return weekRangeLabel(monday, sunday);
  }, [dayKey, monday, sunday]);

  const venuesQuery = useQuery({ queryKey: ["front-desk-venues"], queryFn: () => venues.mine() });
  const venuesList = venuesQuery.data ?? [];

  const bookingsQuery = useQuery({
    queryKey: ["front-desk-bookings", fromKey, toKey],
    queryFn: () => business.listBookings({ date_from: fromKey, date_to: toKey })
  });

  const bookings = useMemo(() => {
    const list = bookingsQuery.data?.data ?? [];
    return [...list].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [bookingsQuery.data]);

  // Derive the selected booking from the live list so an action (check-in,
  // mark paid, no-show) refreshes the sheet in place instead of showing the
  // stale snapshot captured at open time.
  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedId) ?? null,
    [bookings, selectedId]
  );

  const upcoming = bookings.filter((b) => b.status === "confirmed" || b.status === "checked_in");
  const past = bookings.filter((b) => !["confirmed", "checked_in"].includes(b.status));

  const selectToday = () => {
    setWeekOffset(0);
    setDayKey(todayKey);
  };
  const selectWeek = (offset: number) => {
    setWeekOffset(offset);
    setDayKey(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Front desk</h1>
          <p className="mt-1 text-sm text-ink-2">{rangeLabel}</p>
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

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Bookings range">
          <Button
            variant={dayKey === todayKey ? "primary" : "secondary"}
            size="sm"
            onClick={selectToday}
          >
            Today
          </Button>
          <Button
            variant={weekOffset === 0 && dayKey === null ? "primary" : "secondary"}
            size="sm"
            onClick={() => selectWeek(0)}
          >
            This week
          </Button>
          <Button
            variant={weekOffset === 1 && dayKey === null ? "primary" : "secondary"}
            size="sm"
            onClick={() => selectWeek(1)}
          >
            Next week
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pick a day of the week">
          {WEEKDAY_NAMES.map((name, i) => {
            const key = addDaysKey(monday, i);
            const isSelected = dayKey === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setDayKey(isSelected ? null : key)}
                className={cn(
                  "press flex w-16 shrink-0 flex-col items-center rounded-2xl border px-2 py-2 text-center transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-white shadow-soft"
                    : "border-border bg-surface text-ink hover:border-primary/50 hover:bg-primary-light hover:text-primary"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide">{name}</span>
                <span className="text-sm font-bold tabular-nums">{dayjs(key, "YYYY-MM-DD").format("D MMM")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {bookingsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : bookingsQuery.isError ? (
        <EmptyState title="Could not load bookings" message="Please try again." />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings in this range"
          message="Use Quick book to add a walk-in, or pick another day or week."
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
      <div className="w-24 shrink-0 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{dayjs(booking.start_at).format("ddd D MMM")}</p>
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

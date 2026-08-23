"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarX2, ChevronRight, Clock } from "lucide-react";
import { bookings as bookingsApi, toApiFailure } from "@myslot/api";
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  SkeletonRow,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast
} from "@myslot/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@myslot/utils";
import type { Booking } from "@myslot/types";
import { useAuth } from "@/context/auth";
import { BookingDetailDialog } from "./booking-detail-dialog";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" }
] as const;

type TabValue = (typeof TABS)[number]["value"];

const EMPTY_STATE: Record<TabValue, { title: string; message: string }> = {
  upcoming: {
    title: "No upcoming bookings",
    message: "Book a court and your upcoming games will appear here."
  },
  past: {
    title: "No past bookings",
    message: "Your completed games will show up here."
  },
  cancelled: {
    title: "No cancelled bookings",
    message: "Bookings you cancel will appear here."
  }
};

const CANCELLABLE = new Set(["pending", "confirmed", "no_show", "failed"]);

function matchesTab(booking: Booking, tab: TabValue): boolean {
  if (tab === "cancelled") return booking.status === "cancelled";
  if (tab === "past") return ["checked_in", "completed", "no_show", "failed"].includes(booking.status);
  return ["pending", "confirmed"].includes(booking.status);
}

interface Feedback {
  tone: "success" | "error";
  title: string;
  message?: string;
}

export function BookingsList() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const raw = searchParams?.get("status");
  const tab: TabValue = TABS.some((t) => t.value === raw) ? (raw as TabValue) : "upcoming";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsApi.list(),
    enabled: !!user
  });

  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const items = useMemo(() => (data ?? []).filter((booking) => matchesTab(booking, tab)), [data, tab]);
  const count = items.length;

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "upcoming") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    const query = params.toString();
    router.replace(query ? `/bookings?${query}` : "/bookings");
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await bookingsApi.cancel(cancelTarget.id);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setFeedback({
        tone: "success",
        title: "Booking cancelled",
        message: `${cancelTarget.venue_name} on ${formatDateLong(cancelTarget.start_at)} has been cancelled.`
      });
      setCancelTarget(null);
    } catch (err) {
      const failure = toApiFailure(err);
      setFeedback({ tone: "error", title: "Could not cancel", message: failure.message });
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            My bookings
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {count} {tab === "upcoming" ? "upcoming" : tab} booking{count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {feedback && (
        <div className="mt-4">
          <Toast
            tone={feedback.tone}
            title={feedback.title}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}

      <div className="mt-6">
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <div className="grid gap-4">
                {!user ? (
                  <EmptyState
                    title="Sign in to see your bookings"
                    message="Log in to view your upcoming games and booking history."
                    actionLabel="Go to login"
                    onAction={() => router.replace("/login")}
                  />
                ) : isLoading ? (
                  [0, 1, 2].map((i) => <SkeletonRow key={i} />)
                ) : isError ? (
                  <ErrorState onRetry={() => refetch()} />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon={CalendarX2}
                    title={EMPTY_STATE[tab].title}
                    message={EMPTY_STATE[tab].message}
                  />
                ) : (
                  items.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      onOpen={() => setDetail(booking)}
                      onCancel={() => setCancelTarget(booking)}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        {cancelTarget && (
          <DialogContent
            title="Cancel this booking?"
            description={`${cancelTarget.venue_name}${cancelTarget.court_name ? ` · ${cancelTarget.court_name}` : ""} on ${formatDateLong(cancelTarget.start_at)}, ${formatTime12(cancelTarget.start_at)}–${formatTime12(cancelTarget.end_at)}`}
            onClose={() => setCancelTarget(null)}
          >
            <p className="text-sm text-ink-2">
              This frees your court slot immediately and cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={cancelling} onClick={() => setCancelTarget(null)}>
                Keep booking
              </Button>
              <Button variant="destructive" loading={cancelling} onClick={confirmCancel}>
                Cancel booking
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <BookingDetailDialog booking={detail} open={!!detail} onOpenChange={(open) => !open && setDetail(null)} />
    </main>
  );
}

function BookingRow({
  booking,
  onOpen,
  onCancel
}: {
  booking: Booking;
  onOpen: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="p-4">
      <button type="button" onClick={onOpen} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{booking.venue_name}</p>
          <p className="mt-0.5 text-sm text-ink-2">
            {booking.court_name}
            {booking.sport ? ` · ${booking.sport}` : ""}
          </p>
        </div>
        <StatusPill status={booking.status} />
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDateLong(booking.start_at)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatTime12(booking.start_at)}–{formatTime12(booking.end_at)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-lg font-extrabold text-ink">{formatLkr(booking.total_price)}</span>
        <div className="flex items-center gap-2">
          {CANCELLABLE.has(booking.status) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-error hover:bg-error-light hover:text-error"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpen}>
            View <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
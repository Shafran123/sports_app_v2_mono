"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, MapPin, XCircle } from "lucide-react";
import { admin } from "@myslot/api";
import type { Venue } from "@myslot/types";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Textarea,
  VenueVisual
} from "@myslot/ui";
import { formatDateLong } from "@myslot/utils";
import { useToasts } from "./toasts";

type PendingVenue = Venue & {
  owner_name?: string | null;
  owner_email?: string | null;
  courts_count?: number;
  court_count?: number;
  created_at?: string;
};

export function ApprovalsQueue() {
  const { push, viewport } = useToasts();
  const [items, setItems] = useState<PendingVenue[]>([]);
  const [rejectTarget, setRejectTarget] = useState<PendingVenue | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-pending-venues"],
    queryFn: () => admin.pendingVenues()
  });

  useEffect(() => {
    if (listQuery.data) setItems(listQuery.data as PendingVenue[]);
  }, [listQuery.data]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => admin.approveVenue(id),
    onSuccess: () => {
      setApprovingId(null);
      push("success", "Venue approved", "The owner has been notified.");
    },
    onError: () => {
      setApprovingId(null);
      push("error", "Could not approve venue", "Please try again or reload the page.");
      void listQuery.refetch();
    }
  });

  const approve = (venue: PendingVenue) => {
    setItems((prev) => prev.filter((v) => v.id !== venue.id));
    setApprovingId(venue.id);
    approveMutation.mutate(venue.id);
  };

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => admin.rejectVenue(id, { reason }),
    onSuccess: () => {
      push("success", "Venue rejected", "The owner has been notified.");
      closeReject();
    },
    onError: () => {
      setRejectError("We could not reject this venue. Please try again.");
      push("error", "Could not reject venue", "Please try again or reload the page.");
      void listQuery.refetch();
    }
  });

  const openReject = (venue: PendingVenue) => {
    setRejectTarget(venue);
    setReason("");
    setReasonError(null);
    setRejectError(null);
  };

  const closeReject = () => {
    setRejectTarget(null);
    setReason("");
    setReasonError(null);
    setRejectError(null);
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    if (!reason.trim()) {
      setReasonError("A rejection reason is required.");
      return;
    }
    const id = rejectTarget.id;
    setItems((prev) => prev.filter((v) => v.id !== id));
    rejectMutation.mutate({ id, reason: reason.trim() });
  };

  const courtsFor = (venue: PendingVenue) => venue.courts_count ?? venue.court_count ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            Venue approvals
          </h1>
          <p className="mt-1 text-sm text-ink-2">Review submissions from venue owners.</p>
        </div>
        <Badge variant="warning" className="text-sm">
          {items.length} pending
        </Badge>
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          title="Could not load pending venues"
          message="We could not fetch the approvals queue right now."
          onRetry={() => listQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No pending venues"
          message="All caught up — no venue submissions are waiting for review."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((venue) => (
            <Card key={venue.id} className="flex flex-col overflow-hidden">
              <div className="grid gap-4 p-5 sm:grid-cols-[7.5rem_1fr]">
                <VenueVisual
                  venue={venue}
                  alt={venue.name}
                  className="h-28 w-full rounded-2xl"
                  glyphClass="text-3xl"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold tracking-tight text-ink">{venue.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {venue.city}
                  </p>
                  <p className="mt-2 truncate text-sm text-ink-3">
                    <span className="text-ink-2">{venue.owner_name || "Unlisted owner"}</span>
                    {venue.owner_email ? ` \u00b7 ${venue.owner_email}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Submitted{" "}
                    {venue.created_at ? formatDateLong(venue.created_at) : "recently"}
                  </p>
                  <div className="mt-2">
                    <Badge variant="outline">
                      {courtsFor(venue)} {courtsFor(venue) === 1 ? "court" : "courts"}
                    </Badge>
                  </div>
                </div>
              </div>
              {venue.description && (
                <p className="border-t border-border px-5 py-3 text-sm text-ink-2">{venue.description}</p>
              )}
              <div className="mt-auto flex gap-2 border-t border-border p-4">
                <Button
                  variant="outline"
                  className="border-error text-error hover:bg-error-light"
                  onClick={() => openReject(venue)}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button loading={approvingId === venue.id} onClick={() => approve(venue)}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && closeReject()}>
        {rejectTarget && (
          <DialogContent
            title="Reject venue"
            description={`The owner of ${rejectTarget.name} will be notified of the reason.`}
            onClose={closeReject}
          >
            <div className="space-y-1.5">
              <Textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
                placeholder="Why is this venue being rejected?"
                error={!!reasonError}
                rows={4}
                autoFocus
              />
              {reasonError && <p className="text-xs text-error">{reasonError}</p>}
            </div>
            {rejectError && <p className="mt-3 text-sm text-error">{rejectError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeReject}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                loading={rejectMutation.isPending}
                disabled={!reason.trim()}
                onClick={confirmReject}
              >
                Reject venue
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {viewport}
    </div>
  );
}
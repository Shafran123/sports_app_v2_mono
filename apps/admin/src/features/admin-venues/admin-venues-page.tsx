"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MapPin, ShieldAlert, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { admin } from "@myslot/api";
import type { Venue, VenueAudit } from "@myslot/types";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  SkeletonCard,
  StatusPill,
  Textarea
} from "@myslot/ui";
import { formatDateLong } from "@myslot/utils";
import { useToasts } from "@/features/admin-console/toasts";

type AdminVenue = Venue & {
  owner_name?: string | null;
  owner_email?: string | null;
  court_count?: number;
  courts_count?: number;
  created_at?: string;
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  suspended: "Suspended",
  banned: "Banned",
  archived: "Archived"
};

type LifecycleAction = "suspend" | "unsuspend" | "ban" | "archive";

const ACTION_LABEL: Record<LifecycleAction, string> = {
  suspend: "suspended",
  unsuspend: "unsuspended",
  ban: "banned",
  archive: "archived"
};

export function AdminVenuesPage() {
  const { push, viewport } = useToasts();
  const queryClient = useQueryClient();
  const [actionTarget, setActionTarget] = useState<{ venue: AdminVenue; action: LifecycleAction } | null>(null);
  const [reason, setReason] = useState("");
  const [auditVenue, setAuditVenue] = useState<AdminVenue | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-all-venues"],
    queryFn: () => admin.listVenues()
  });

  const auditQuery = useQuery({
    queryKey: ["admin-venue-audit", auditVenue?.id],
    queryFn: () => (auditVenue ? admin.venueAudit(auditVenue.id) : Promise.resolve([])),
    enabled: !!auditVenue
  });

  const actionMutation = useMutation({
    mutationFn: async ({ venue, action }: { venue: AdminVenue; action: LifecycleAction }) => {
      switch (action) {
        case "suspend":
          return admin.suspendVenue(venue.id, { reason });
        case "unsuspend":
          return admin.unsuspendVenue(venue.id);
        case "ban":
          return admin.banVenue(venue.id, { reason });
        case "archive":
          return admin.archiveVenue(venue.id);
      }
    },
    onSuccess: (_data, vars) => {
      push("success", "Venue updated", `${vars.venue.name} is now ${ACTION_LABEL[vars.action]}.`);
      setActionTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-all-venues"] });
    },
    onError: () => {
      push("error", "Could not update venue", "Please try again or reload the page.");
    }
  });

  const confirmAction = () => {
    if (!actionTarget) return;
    if ((actionTarget.action === "suspend" || actionTarget.action === "ban") && !reason.trim()) {
      push("error", "A reason is required", "Explain why you are taking this action.");
      return;
    }
    actionMutation.mutate(actionTarget);
  };

  const courtsFor = (v: AdminVenue) => v.court_count ?? v.courts_count ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
          Venues
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Review, suspend, ban or archive every venue on the platform.
        </p>
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-40" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          title="Could not load venues"
          message="We could not fetch the venue list right now."
          onRetry={() => listQuery.refetch()}
        />
      ) : (listQuery.data ?? []).length === 0 ? (
        <EmptyState title="No venues" message="There are no venues on the platform yet." />
      ) : (
        <div className="space-y-3">
          {(listQuery.data ?? []).map((venue) => {
            const banned = venue.status === "banned";
            return (
              <Card key={venue.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold tracking-tight text-ink">{venue.name}</h3>
                      <StatusPill status={venue.status}>{STATUS_LABEL[venue.status] ?? venue.status}</StatusPill>
                      {banned && (
                        <Badge variant="error">
                          <ShieldBan className="h-3 w-3" /> Owner banned
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {venue.city}
                      {venue.owner_name ? ` · ${venue.owner_name}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {courtsFor(venue)} {courtsFor(venue) === 1 ? "court" : "courts"} ·{" "}
                      {venue.created_at ? `created ${formatDateLong(venue.created_at)}` : ""}
                      {venue.accepts_cash ? " · accepts cash" : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAuditVenue(venue)}
                    >
                      <History className="h-4 w-4" /> Audit
                    </Button>
                    {venue.status === "approved" && (
                      <Button variant="outline" size="sm" onClick={() => { setReason(""); setActionTarget({ venue, action: "suspend" }); }}>
                        <ShieldAlert className="h-4 w-4" /> Suspend
                      </Button>
                    )}
                    {venue.status === "suspended" && (
                      <Button variant="outline" size="sm" onClick={() => actionMutation.mutate({ venue, action: "unsuspend" })}>
                        <ShieldCheck className="h-4 w-4" /> Unsuspend
                      </Button>
                    )}
                    {["approved", "suspended"].includes(venue.status) && (
                      <Button variant="outline" size="sm" className="border-error text-error hover:bg-error-light" onClick={() => { setReason(""); setActionTarget({ venue, action: "ban" }); }}>
                        <ShieldBan className="h-4 w-4" /> Ban
                      </Button>
                    )}
                    {["approved", "suspended", "banned"].includes(venue.status) && (
                      <Button variant="outline" size="sm" className="border-error/60 text-error hover:bg-error-light" onClick={() => actionMutation.mutate({ venue, action: "archive" })}>
                        <Trash2 className="h-4 w-4" /> Archive
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        {actionTarget && (
          <DialogContent
            title={actionTarget.action === "ban" ? `Ban ${actionTarget.venue.name}` : `Suspend ${actionTarget.venue.name}`}
            description={
              actionTarget.action === "ban"
                ? "The owner will lose console access and all their venues become unbookable. This is permanent."
                : "The venue will be hidden and stop taking new bookings. Existing bookings still play out."
            }
            onClose={() => setActionTarget(null)}
          >
            <div className="space-y-1.5">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for this action (recorded in the audit log)"
                rows={3}
                autoFocus
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setActionTarget(null)}>
                Cancel
              </Button>
              <Button
                variant={actionTarget.action === "ban" ? "destructive" : "primary"}
                loading={actionMutation.isPending}
                disabled={["suspend", "ban"].includes(actionTarget.action) && !reason.trim()}
                onClick={confirmAction}
              >
                {actionTarget.action === "ban" ? "Ban venue" : "Suspend venue"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={!!auditVenue} onOpenChange={(open) => !open && setAuditVenue(null)}>
        {auditVenue && (
          <DialogContent
            title={`Audit trail — ${auditVenue.name}`}
            description="Every admin action on this venue, newest first."
            onClose={() => setAuditVenue(null)}
          >
            {auditQuery.isLoading ? (
              <div className="space-y-2">
                <SkeletonCard className="h-12" />
                <SkeletonCard className="h-12" />
              </div>
            ) : (auditQuery.data ?? []).length === 0 ? (
              <EmptyState title="No audit entries" message="No admin actions recorded yet." />
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto">
                {(auditQuery.data ?? []).map((entry: VenueAudit, i: number) => (
                  <li key={i} className="rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-sm">
                    <p className="font-medium text-ink capitalize">
                      {String(entry.action).replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-ink-2">
                      {entry.actor_name || entry.actor_email || "System"} ·{" "}
                      {entry.created_at ? formatDateLong(entry.created_at) : ""}
                    </p>
                    {entry.reason && <p className="mt-0.5 text-xs text-ink-3">{entry.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        )}
      </Dialog>

      {viewport}
    </div>
  );
}
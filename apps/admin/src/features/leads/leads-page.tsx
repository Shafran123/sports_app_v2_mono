"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admin, toApiFailure } from "@myslot/api";
import { Button, Card, EmptyState, ErrorState, Input, SelectSheet, Textarea } from "@myslot/ui";
import { formatDateLong } from "@myslot/utils";
import type { OwnerLead } from "@myslot/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" }
];

export function LeadsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-leads", statusFilter],
    queryFn: () => admin.listLeads(statusFilter === "all" ? undefined : statusFilter)
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status?: string; admin_notes?: string }) => admin.updateLead(input.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      setError(null);
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not update the lead.")
  });

  const leads = data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Leads</h1>
        <p className="mt-1 text-sm text-ink-2">
          People who want to list their place. Contact them, then convert the best into owners.
        </p>
      </div>

      <Card className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:w-52">
          <label htmlFor="leads-status" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Status
          </label>
          <SelectSheet id="leads-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectSheet>
        </div>
      </Card>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5"><div className="skeleton h-16 rounded-2xl" /></Card>
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Could not load leads" message="The leads queue is unavailable right now." onRetry={() => refetch()} />
      ) : leads.length === 0 ? (
        <EmptyState title="No leads yet" message={'New "list your place" submissions will appear here.'} />
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              notes={notes[lead.id] ?? lead.admin_notes ?? ""}
              onNotesChange={(v) => setNotes((n) => ({ ...n, [lead.id]: v }))}
              onStatus={(status) => update.mutate({ id: lead.id, status })}
              onSaveNotes={() => update.mutate({ id: lead.id, admin_notes: notes[lead.id] ?? "" })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  notes,
  onNotesChange,
  onStatus,
  onSaveNotes
}: {
  lead: OwnerLead;
  notes: string;
  onNotesChange: (v: string) => void;
  onStatus: (status: string) => void;
  onSaveNotes: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-ink">{lead.name}</p>
            {lead.is_duplicate && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Possible duplicate</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-2">{lead.email}{lead.phone ? ` • ${lead.phone}` : ""}</p>
          <p className="mt-1 text-sm text-ink-2">
            {lead.venue_name ? <><strong>{lead.venue_name}</strong>{lead.city ? ` — ${lead.city}` : ""}</> : lead.city ?? "No venue name"}
          </p>
          {lead.message && <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{lead.message}</p>}
          <p className="mt-2 text-xs text-ink-3">Submitted {formatDateLong(lead.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {lead.status !== "converted" && lead.status !== "closed" && (
            <>
              <Button variant="secondary" size="sm" onClick={() => onStatus("contacted")} disabled={lead.status === "contacted"}>
                {lead.status === "contacted" ? "Contacted" : "Mark contacted"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onStatus("closed")}>Close</Button>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
        <div className="w-full flex-1 space-y-1.5">
          <label htmlFor={`lead-notes-${lead.id}`} className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Admin notes
          </label>
          <Input id={`lead-notes-${lead.id}`} value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Notes for follow-up…" />
        </div>
        <Button variant="secondary" size="sm" onClick={onSaveNotes}>Save notes</Button>
      </div>
    </Card>
  );
}
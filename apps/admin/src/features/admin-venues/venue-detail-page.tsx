"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Info, Lock, MapPin, Plus, Trash2 } from "lucide-react";
import { courts, sports, venues, business, getClient, toApiFailure } from "@spots/api";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@spots/ui";
import { dayName, formatLkr } from "@spots/utils";
import type { Block, VenueHours } from "@spots/types";
import { fetchMyVenues, fetchOwnerCourts } from "./venue-api";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected"
};

const DAYS = 7;

interface CourtDraft {
  name: string;
  sport: string;
  price_per_slot: string;
  slot_duration_min: string;
  capacity: string;
  is_indoor: boolean;
}

const blankCourtDraft = (): CourtDraft => ({
  name: "",
  sport: "",
  price_per_slot: "",
  slot_duration_min: "60",
  capacity: "",
  is_indoor: false
});

const blankDays = (): VenueHours[] =>
  Array.from({ length: DAYS }, (_, i) => ({ day_of_week: i, open_time: "", close_time: "" }));

function formatBlockRange(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function VenueDetailPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mineQuery = useQuery({
    queryKey: ["my-venues"],
    queryFn: () => fetchMyVenues()
  });
  const venue = mineQuery.data?.find((v) => v.id === venueId);

  const courtsQuery = useQuery({
    queryKey: ["owner-courts"],
    queryFn: () => fetchOwnerCourts()
  });
  const venueCourts = useMemo(
    () => (courtsQuery.data ?? []).filter((c) => c.venue_id === venueId),
    [courtsQuery.data, venueId]
  );

  const detailQuery = useQuery({
    queryKey: ["venue-detail", venueId],
    queryFn: () => venues.detail(venueId),
    enabled: venue?.status === "approved"
  });

  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });

  const blocksQuery = useQuery({
    queryKey: ["venue-blocks", venueId, venueCourts.map((c) => c.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        venueCourts.map(async (c) => [c.id, await business.listBlocks(c.id)] as const)
      );
      return Object.fromEntries(entries) as Record<string, Block[]>;
    },
    enabled: venueCourts.length > 0
  });

  const [hours, setHours] = useState<VenueHours[]>(blankDays());
  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState("");
  const [hoursNotice, setHoursNotice] = useState("");

  useEffect(() => {
    if (!detailQuery.data?.hours) return;
    setHours(
      Array.from({ length: DAYS }, (_, i) => {
        const h = detailQuery.data.hours.find((x) => Number(x.day_of_week) === i);
        return { day_of_week: i, open_time: h?.open_time ?? "", close_time: h?.close_time ?? "" };
      })
    );
  }, [detailQuery.data?.hours]);

  const [courtDraft, setCourtDraft] = useState<CourtDraft>(blankCourtDraft());
  const [addingCourt, setAddingCourt] = useState(false);
  const [courtError, setCourtError] = useState("");
  const [togglingCourtId, setTogglingCourtId] = useState<string | null>(null);
  const [courtActionError, setCourtActionError] = useState("");

  const [blockForms, setBlockForms] = useState<Record<string, { start: string; end: string; reason: string }>>({});
  const [blockBusyId, setBlockBusyId] = useState<string | null>(null);
  const [blockDeletingId, setBlockDeletingId] = useState<string | null>(null);
  const [blockError, setBlockError] = useState("");

  const refreshCourts = () => queryClient.invalidateQueries({ queryKey: ["owner-courts"] });
  const refreshBlocks = () => queryClient.invalidateQueries({ queryKey: ["venue-blocks"] });

  const handleAddCourt = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCourtError("");
    if (!courtDraft.name.trim()) {
      setCourtError("Court name is required.");
      return;
    }
    if (!courtDraft.sport) {
      setCourtError("Pick a sport.");
      return;
    }
    if (!courtDraft.price_per_slot || Number(courtDraft.price_per_slot) <= 0) {
      setCourtError("Enter a valid price per slot.");
      return;
    }
    setAddingCourt(true);
    try {
      await courts.create({
        venue_id: venueId,
        name: courtDraft.name.trim(),
        sport: courtDraft.sport,
        price_per_slot: Number(courtDraft.price_per_slot),
        slot_duration_min: Number(courtDraft.slot_duration_min) || 60,
        capacity: courtDraft.capacity ? Number(courtDraft.capacity) : undefined,
        is_indoor: courtDraft.is_indoor
      });
      setCourtDraft(blankCourtDraft());
      await refreshCourts();
      queryClient.invalidateQueries({ queryKey: ["my-venues"] });
    } catch (err) {
      setCourtError(toApiFailure(err).message);
    } finally {
      setAddingCourt(false);
    }
  };

  const toggleCourtActive = async (courtId: string, isActive: boolean | undefined) => {
    setTogglingCourtId(courtId);
    setCourtActionError("");
    try {
      await courts.update(courtId, { is_active: !isActive });
      await refreshCourts();
    } catch (err) {
      setCourtActionError(toApiFailure(err).message);
    } finally {
      setTogglingCourtId(null);
    }
  };

  const updateHour = (day: number, field: "open_time" | "close_time", value: string) => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, [field]: value } : h)));
  };

  const saveHours = async () => {
    setHoursError("");
    setHoursNotice("");
    for (const h of hours) {
      if (Boolean(h.open_time) !== Boolean(h.close_time)) {
        setHoursError(
          `Set both open and close time for ${dayName(h.day_of_week)}, or leave both blank to mark it closed.`
        );
        return;
      }
      if (h.open_time && h.close_time && h.close_time <= h.open_time) {
        setHoursError(`Close time must be after open time for ${dayName(h.day_of_week)}.`);
        return;
      }
    }
    setSavingHours(true);
    try {
      await business.updateVenueHours(
        venueId,
        hours
          .filter((h) => Boolean(h.open_time) && Boolean(h.close_time))
          .map((h) => ({ day_of_week: h.day_of_week, open_time: h.open_time!, close_time: h.close_time! }))
      );
      setHoursNotice("Opening hours saved.");
      queryClient.invalidateQueries({ queryKey: ["venue-detail", venueId] });
    } catch (err) {
      setHoursError(toApiFailure(err).message);
    } finally {
      setSavingHours(false);
    }
  };

  const updateBlockForm = (courtId: string, patch: Partial<{ start: string; end: string; reason: string }>) => {
    setBlockForms((prev) => ({ ...prev, [courtId]: { start: "", end: "", reason: "", ...prev[courtId], ...patch } }));
  };

  const addBlock = async (courtId: string) => {
    const form = blockForms[courtId] ?? { start: "", end: "", reason: "" };
    setBlockError("");
    if (!form.start || !form.end) {
      setBlockError("Pick both a start and an end time.");
      return;
    }
    if (new Date(form.end) <= new Date(form.start)) {
      setBlockError("End time must be after start time.");
      return;
    }
    if (!form.reason.trim()) {
      setBlockError("Add a reason for the block.");
      return;
    }
    setBlockBusyId(courtId);
    try {
      await business.createBlock(courtId, {
        start_at: new Date(form.start).toISOString(),
        end_at: new Date(form.end).toISOString(),
        reason: form.reason.trim()
      });
      setBlockForms((prev) => ({ ...prev, [courtId]: { start: "", end: "", reason: "" } }));
      await refreshBlocks();
    } catch (err) {
      setBlockError(toApiFailure(err).message);
    } finally {
      setBlockBusyId(null);
    }
  };

  const deleteBlock = async (courtId: string, blockId: string) => {
    setBlockDeletingId(blockId);
    setBlockError("");
    try {
      await business.deleteBlock(courtId, blockId);
      await refreshBlocks();
    } catch (err) {
      setBlockError(toApiFailure(err).message);
    } finally {
      setBlockDeletingId(null);
    }
  };

  if (mineQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (mineQuery.isError || !mineQuery.data) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorState
          title="Could not load venue"
          message="We could not load your venue right now. Please try again."
          onRetry={() => mineQuery.refetch()}
        />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackLink />
        <div className="mt-6 flex flex-col items-center rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-soft">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-error">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-xl font-extrabold tracking-tight text-ink">Access denied</h1>
          <p className="mt-2 max-w-sm text-sm text-ink-2">You can only manage venues you own.</p>
          <Button onClick={() => router.push("/venues")} className="mt-6">
            Back to My Venues
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            {venue.name}
          </h1>
          <StatusPill status={venue.status}>{STATUS_LABEL[venue.status] ?? venue.status}</StatusPill>
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {venue.city}
          {venue.address ? ` · ${venue.address}` : ""}
        </p>
      </div>

      {venue.status !== "approved" && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-light px-4 py-3 text-sm text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {venue.status === "rejected"
              ? "Your venue was not approved. Fix the issues and submit again."
              : "Your venue is being reviewed. Players will see it once it's approved."}
          </p>
        </div>
      )}

      <Tabs defaultValue="courts">
        <TabsList className="w-full max-w-full overflow-x-auto lg:w-auto">
          <TabsTrigger value="courts" className="shrink-0">Courts</TabsTrigger>
          <TabsTrigger value="hours" className="shrink-0">Hours</TabsTrigger>
          <TabsTrigger value="blocks" className="shrink-0">Blocks</TabsTrigger>
        </TabsList>

        <TabsContent value="courts">
          <div className="space-y-4">
            <div className="rounded-3xl border border-dashed border-border bg-surface p-5 md:p-6">
              <h3 className="font-bold tracking-tight text-ink">Add court</h3>
              {courtError && (
                <p className="mt-2 rounded-xl bg-error-light px-3 py-2 text-sm text-error">{courtError}</p>
              )}
              <form onSubmit={handleAddCourt} className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">
                      Court name <span className="text-error">*</span>
                    </span>
                    <Input
                      value={courtDraft.name}
                      onChange={(e) => setCourtDraft({ ...courtDraft, name: e.target.value })}
                      placeholder="Court 1"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">
                      Sport <span className="text-error">*</span>
                    </span>
                    <Select
                      value={courtDraft.sport}
                      onChange={(e) => setCourtDraft({ ...courtDraft, sport: e.target.value })}
                    >
                      <option value="">Select a sport</option>
                      {(sportsQuery.data ?? []).map((s) => (
                        <option key={s.id} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">
                      Price per slot (Rs) <span className="text-error">*</span>
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={courtDraft.price_per_slot}
                      onChange={(e) => setCourtDraft({ ...courtDraft, price_per_slot: e.target.value })}
                      placeholder="1500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">Slot duration (minutes)</span>
                    <Input
                      type="number"
                      min="15"
                      step="15"
                      value={courtDraft.slot_duration_min}
                      onChange={(e) => setCourtDraft({ ...courtDraft, slot_duration_min: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">Capacity</span>
                    <Input
                      type="number"
                      min="1"
                      value={courtDraft.capacity}
                      onChange={(e) => setCourtDraft({ ...courtDraft, capacity: e.target.value })}
                      placeholder="4"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium text-ink-2">
                    <Checkbox
                      checked={courtDraft.is_indoor}
                      onChange={(e) => setCourtDraft({ ...courtDraft, is_indoor: e.target.checked })}
                    />
                    Indoor court
                  </label>
                </div>
                <Button type="submit" loading={addingCourt}>
                  {addingCourt ? "Adding…" : "Add court"}
                </Button>
              </form>
            </div>

            {courtActionError && (
              <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{courtActionError}</p>
            )}

            {courtsQuery.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="mt-3 h-4 w-1/3" />
                    <Skeleton className="mt-4 h-14 w-full" />
                  </div>
                ))}
              </div>
            ) : courtsQuery.isError ? (
              <ErrorState title="Could not load courts" onRetry={() => refreshCourts()} />
            ) : venueCourts.length === 0 ? (
              <EmptyState
                title="No courts yet"
                message="Add your first court to start taking bookings."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {venueCourts.map((court) => {
                  const archived = court.is_active === false;
                  return (
                    <Card key={court.id} className={archived ? "opacity-70" : ""}>
                      <div className="p-5 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold tracking-tight text-ink">{court.name}</h3>
                              <Badge variant={court.is_indoor ? "accent" : "neutral"}>
                                {court.is_indoor ? "Indoor" : "Outdoor"}
                              </Badge>
                              <StatusPill status={archived ? "neutral" : "active"}>
                                {archived ? "Archived" : "Active"}
                              </StatusPill>
                            </div>
                            <p className="mt-0.5 text-sm text-ink-2">
                              {court.sport_name ?? court.sport_slug ?? "—"}
                            </p>
                          </div>
                          <p className="shrink-0 font-display text-xl font-extrabold tracking-tight text-ink">
                            {formatLkr(court.price_per_slot)}
                          </p>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                          <p className="text-xs text-ink-3">
                            {court.slot_duration_min ?? 60} min slots · capacity {court.capacity ?? "—"}
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={togglingCourtId === court.id}
                            onClick={() => toggleCourtActive(court.id, court.is_active)}
                          >
                            {archived ? "Unarchive" : "Archive"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="hours">
          <div className="space-y-4">
            {venue.status !== "approved" && (
              <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-light px-4 py-3 text-sm text-warning">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Opening hours are only visible to players once your venue is approved. You can still
                  set them below — we'll show them as soon as your venue goes live.
                </p>
              </div>
            )}
            <Card className="p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
                    Opening hours
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-3">Leave a day blank to mark it closed.</p>
                </div>
                <Button type="button" onClick={saveHours} loading={savingHours}>
                  {savingHours ? "Saving…" : "Save hours"}
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {hours.map((hour) => (
                  <div
                    key={hour.day_of_week}
                    className="grid grid-cols-2 items-center gap-2 rounded-2xl bg-surface-2/60 px-3 py-2.5 sm:grid-cols-[9rem_1fr_1fr] sm:gap-3"
                  >
                    <span className="col-span-2 flex items-center gap-1.5 text-sm font-medium text-ink sm:col-span-1">
                      <Clock className="h-3.5 w-3.5 text-ink-3" /> {dayName(hour.day_of_week)}
                    </span>
                    <Input
                      type="time"
                      aria-label={`${dayName(hour.day_of_week)} open time`}
                      value={hour.open_time}
                      onChange={(e) => updateHour(hour.day_of_week, "open_time", e.target.value)}
                    />
                    <Input
                      type="time"
                      aria-label={`${dayName(hour.day_of_week)} close time`}
                      value={hour.close_time}
                      onChange={(e) => updateHour(hour.day_of_week, "close_time", e.target.value)}
                    />
                  </div>
                ))}
              </div>
              {hoursError && (
                <p className="mt-3 rounded-lg bg-error-light px-3 py-2 text-sm text-error">{hoursError}</p>
              )}
              {hoursNotice && (
                <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success-light px-3 py-2 text-sm text-success">
                  {hoursNotice}
                </p>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="blocks">
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Slot blocks</h2>
              <p className="mt-0.5 text-xs text-ink-3">
                Block time ranges per court so customers cannot book them.
              </p>
            </div>
            {blockError && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{blockError}</p>}

            {courtsQuery.isLoading ? (
              <div className="space-y-4">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="mt-3 h-20 w-full" />
                  </div>
                ))}
              </div>
            ) : courtsQuery.isError ? (
              <ErrorState title="Could not load courts" onRetry={() => refreshCourts()} />
            ) : venueCourts.length === 0 ? (
              <EmptyState title="No courts yet" message="Add a court before blocking time slots." />
            ) : (
              <div className="space-y-4">
                {venueCourts.map((court) => {
                  const courtBlocks = blocksQuery.data?.[court.id] ?? [];
                  const form = blockForms[court.id] ?? { start: "", end: "", reason: "" };
                  return (
                    <Card key={court.id} className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold tracking-tight text-ink">{court.name}</h3>
                          <p className="text-xs text-ink-3">{court.sport_name ?? court.sport_slug ?? "—"}</p>
                        </div>
                        <StatusPill status={court.is_active === false ? "neutral" : "active"}>
                          {court.is_active === false ? "Archived" : "Active"}
                        </StatusPill>
                      </div>

                      {blocksQuery.isLoading ? (
                        <Skeleton className="mt-3 h-8 w-full" />
                      ) : courtBlocks.length === 0 ? (
                        <p className="mt-3 text-sm text-ink-3">No blocks for this court.</p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {courtBlocks.map((block) => (
                            <li
                              key={block.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-ink">
                                  {formatBlockRange(block.start_at)} – {formatBlockRange(block.end_at)}
                                </p>
                                <p className="truncate text-xs text-ink-2">{block.reason}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteBlock(court.id, block.id)}
                                disabled={blockDeletingId === block.id}
                                aria-label="Delete block"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-error-light hover:text-error disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          addBlock(court.id);
                        }}
                        className="mt-4 space-y-3 border-t border-border pt-4"
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-medium text-ink-2">Start</span>
                            <Input
                              type="datetime-local"
                              value={form.start}
                              onChange={(e) => updateBlockForm(court.id, { start: e.target.value })}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-xs font-medium text-ink-2">End</span>
                            <Input
                              type="datetime-local"
                              value={form.end}
                              onChange={(e) => updateBlockForm(court.id, { end: e.target.value })}
                            />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className="mb-1.5 block text-xs font-medium text-ink-2">Reason</span>
                            <Input
                              value={form.reason}
                              onChange={(e) => updateBlockForm(court.id, { reason: e.target.value })}
                              placeholder="Maintenance, tournament…"
                            />
                          </label>
                        </div>
                        <Button type="submit" variant="secondary" size="sm" loading={blockBusyId === court.id}>
                          <Plus className="h-4 w-4" /> Add block
                        </Button>
                      </form>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/venues"
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" /> Back to My Venues
    </Link>
  );
}
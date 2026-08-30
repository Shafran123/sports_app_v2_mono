"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { venues, business, toApiFailure } from "@myslot/api";
import { Button, Dialog, DialogContent, Input, SelectSheet, Skeleton } from "@myslot/ui";
import {
  durationChoices,
  formatDuration,
  formatLkr,
  formatTime12,
  selectRun,
  summarizeSelection,
  toDateKey,
  type SelectedSlots
} from "@myslot/utils";
import type { Slot, Venue } from "@myslot/types";
import { SHEET_CLASS } from "@myslot/ui";
import { useManualBooking } from "@/features/admin-calendar/use-manual-booking";

// Front-desk quick book mirrors the player flow (ADR-0033): pick a duration
// first, then tap the start time and a contiguous run of slots is selected.
// A walk-in can then override the amount (offers / negotiated price) before
// confirming. ADR-0044 (ticket 11): how the owner collects is recorded —
// cash (default), card at the terminal, or a PayHere payment link sent by SMS.
type Collection = "cash" | "card" | "payment_link";
export function QuickBookDialog({
  open,
  onOpenChange,
  venues: myVenues
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
}) {
  const todayKey = toDateKey(new Date());
  const [venueId, setVenueId] = useState("");
  const [courtId, setCourtId] = useState("");
  const [dateKey, setDateKey] = useState(todayKey);
  const [durationMin, setDurationMin] = useState(0);
  const [selected, setSelected] = useState<SelectedSlots>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [collection, setCollection] = useState<Collection>("cash");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (open) {
      setVenueId(myVenues[0]?.id ?? "");
      setCourtId("");
      setDateKey(todayKey);
      setDurationMin(0);
      setSelected({});
      setName("");
      setPhone("");
      setAmount("");
      setCollection("cash");
      setLink("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const availabilityQuery = useQuery({
    queryKey: ["quick-availability", venueId, dateKey],
    queryFn: () => venues.availability(venueId, dateKey),
    enabled: !!venueId && !!dateKey
  });

  const courtOptions = useMemo(
    () => (availabilityQuery.data?.courts ?? []).filter((c) => c.slots.some((s) => s.state === "available")),
    [availabilityQuery.data]
  );

  const selectedCourt = courtOptions.find((c) => c.court_id === courtId);
  const summary = summarizeSelection(selected, availabilityQuery.data);

  // A slot is a valid start only when a full contiguous run of the chosen
  // duration fits from it — mirroring the player picker (selection.ts).
  const validStarts = useMemo(() => {
    if (!selectedCourt || durationMin <= 0) return new Set<string>();
    const runCount = durationMin / selectedCourt.slot_duration_min;
    const set = new Set<string>();
    for (const s of selectedCourt.slots) {
      if (s.state !== "available") continue;
      const run = selectRun({}, selectedCourt, s, durationMin);
      if (Object.keys(run).length === runCount) set.add(s.start_at);
    }
    return set;
  }, [selectedCourt, durationMin]);

  const startSlots: Slot[] = useMemo(
    () => (selectedCourt?.slots ?? []).filter((s) => validStarts.has(s.start_at)),
    [selectedCourt, validStarts]
  );

  const pickDuration = (min: number) => {
    setDurationMin(min);
    setSelected({});
    setAmount("");
  };

  const pickSlot = (slot: Slot) => {
    if (!selectedCourt) return;
    const next = selectRun(selected, selectedCourt, slot, durationMin);
    setSelected(next);
    const total = summarizeSelection(next, availabilityQuery.data).total;
    setAmount(String(total));
  };

  const manual = useManualBooking(venueId, dateKey);

  const canSubmit = !!courtId && summary.count > 0 && Number(amount) > 0;

  const submit = () => {
    if (!canSubmit) return;
    manual.mutate(
      {
        court_id: summary.courtId!,
        start_at: summary.startAt!,
        end_at: summary.endAt!,
        player_name: name.trim() || undefined,
        player_phone: phone.trim() || undefined,
        amount: Number(amount),
        paid_by: collection
      },
      {
        onSuccess: (result) => {
          // ADR-0044: a payment link is SMSed to the guest; surface it here
          // too so the owner can share it (e.g. WhatsApp) if the SMS fails.
          if (result?.payment_link) {
            setLink(result.payment_link);
            return;
          }
          onOpenChange(false);
        }
      }
    );
  };

  const failure = manual.error ? toApiFailure(manual.error) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && manual.reset() && onOpenChange(false)}>
      <DialogContent
        className={SHEET_CLASS}
        title="Quick book"
        description="Book a walk-in player in a few taps."
        onClose={() => onOpenChange(false)}
      >
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="qb-venue" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Venue
            </label>
            <SelectSheet id="qb-venue" value={venueId} onChange={(e) => { setVenueId(e.target.value); setCourtId(""); setDurationMin(0); setSelected({}); }}>
              <option value="">Select a venue</option>
              {myVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </SelectSheet>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="qb-date" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Date
            </label>
            <Input id="qb-date" type="date" value={dateKey} onChange={(e) => { setDateKey(e.target.value); setCourtId(""); setDurationMin(0); setSelected({}); }} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="qb-court" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Court
            </label>
            {availabilityQuery.isLoading ? (
              <Skeleton className="h-11 w-full rounded-2xl" />
            ) : (
              <SelectSheet
                id="qb-court"
                value={courtId}
                onChange={(e) => { setCourtId(e.target.value); setDurationMin(0); setSelected({}); }}
              >
                <option value="">Select a court</option>
                {courtOptions.map((c) => (
                  <option key={c.court_id} value={c.court_id}>
                    {c.name} · {formatLkr(c.price_per_slot)}
                  </option>
                ))}
              </SelectSheet>
            )}
          </div>

          {courtId && selectedCourt && (
            <div className="space-y-1.5">
              <label htmlFor="qb-duration" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Duration
              </label>
              <SelectSheet
                id="qb-duration"
                value={durationMin ? String(durationMin) : ""}
                onChange={(e) => pickDuration(e.target.value ? Number(e.target.value) : 0)}
              >
                <option value="">Select duration</option>
                {durationChoices(selectedCourt, selectedCourt.slots).map((min) => (
                  <option key={min} value={min}>
                    {formatDuration(min)}
                  </option>
                ))}
              </SelectSheet>
            </div>
          )}

          {courtId && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Start time</span>
              {durationMin === 0 ? (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
                  Pick a duration first to see available start times.
                </p>
              ) : startSlots.length === 0 ? (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
                  No start times available for {formatDuration(durationMin)} on this day.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {startSlots.map((s) => {
                    const isSelected = summary.startAt === s.start_at;
                    return (
                      <button
                        key={s.start_at}
                        type="button"
                        onClick={() => pickSlot(s)}
                        className={`flex flex-col items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          isSelected
                            ? "border-primary bg-primary-light text-primary"
                            : "border-border bg-surface text-ink hover:border-ink-3"
                        }`}
                      >
                        {formatTime12(s.start_at)}
                        <span className="text-[10px] font-medium text-ink-3">
                          – {formatTime12(s.end_at)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {summary.count > 0 && (
            <div className="rounded-2xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-2">
                  {summary.courtName} · {formatTime12(summary.startAt!)} – {formatTime12(summary.endAt!)} ·{" "}
                  {formatDuration(summary.durationMin)}
                </span>
                <span className="font-display font-extrabold text-ink">{formatLkr(summary.total)}</span>
              </div>
            </div>
          )}

          {link ? (
            <div className="space-y-3 rounded-2xl border border-success/40 bg-success-light/40 px-4 py-3">
              <p className="text-sm font-medium text-success">Payment link sent by SMS — share it if needed</p>
              <div className="flex gap-2">
                <Input readOnly value={link} aria-label="Payment link" className="font-mono text-xs" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link);
                  }}
                >
                  Copy
                </Button>
              </div>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="qb-collection" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  Collect payment
                </label>
                <SelectSheet id="qb-collection" value={collection} onChange={(e) => setCollection(e.target.value as Collection)}>
                  <option value="cash">Cash at the venue</option>
                  <option value="card">Paid by card (terminal)</option>
                  <option value="payment_link">Send payment link (SMS)</option>
                </SelectSheet>
                {collection === "payment_link" && !phone.trim() && (
                  <p className="text-xs text-ink-3">A payment link needs the player&apos;s phone — SMS delivers it.</p>
                )}
                {collection === "card" && (
                  <p className="text-xs text-ink-3">Records the payment as collected by card — no gateway involved.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="qb-name" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Player name (optional)
                  </label>
                  <Input id="qb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="qb-phone" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Phone {collection === "payment_link" ? "(required)" : "(optional)"}
                  </label>
                  <Input id="qb-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07X XXX XXXX" />
                  {phone.trim() && collection !== "payment_link" && (
                    <p className="text-xs text-ink-3">Their bill link will be sent by SMS.</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="qb-amount" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  Amount (LKR)
                </label>
                <Input id="qb-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
                {summary.total > 0 && Number(amount) !== summary.total && Number(amount) > 0 && (
                  <p className="text-xs text-ink-3">
                    Default slot price: {formatLkr(summary.total)}
                    {Number(amount) < summary.total ? " (offer applied)" : ""}
                  </p>
                )}
              </div>

              {failure && (
                <div className="rounded-2xl bg-error-light px-4 py-3 text-sm text-error">{failure.message}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={manual.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  loading={manual.isPending}
                  disabled={!canSubmit || (collection === "payment_link" && !phone.trim())}
                >
                  Confirm booking
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { venues, business, toApiFailure } from "@spots/api";
import { Button, Dialog, DialogContent, Input, SelectSheet, Skeleton } from "@spots/ui";
import { formatLkr, formatTime12, toDateKey } from "@spots/utils";
import type { Venue } from "@spots/types";
import { SHEET_CLASS } from "@spots/ui";
import { useManualBooking } from "@/features/admin-calendar/use-manual-booking";

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
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [pricePerSlot, setPricePerSlot] = useState(0);

  useEffect(() => {
    if (open) {
      setVenueId(myVenues[0]?.id ?? "");
      setCourtId("");
      setDateKey(todayKey);
      setStartAt("");
      setEndAt("");
      setName("");
      setPhone("");
      setAmount("");
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
  const availableSlots = selectedCourt?.slots.filter((s) => s.state === "available") ?? [];

  const manual = useManualBooking(venueId, dateKey);

  useEffect(() => {
    if (selectedCourt) {
      setAmount(String(selectedCourt.price_per_slot));
      setPricePerSlot(selectedCourt.price_per_slot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId, selectedCourt?.court_id]);

  const pickSlot = (slot: { start_at: string; end_at: string }) => {
    setStartAt(slot.start_at);
    setEndAt(slot.end_at);
  };

  const canSubmit = !!courtId && !!startAt && !!endAt && Number(amount) > 0;

  const submit = () => {
    if (!canSubmit) return;
    manual.mutate(
      {
        court_id: courtId,
        start_at: startAt,
        end_at: endAt,
        player_name: name.trim() || undefined,
        player_phone: phone.trim() || undefined,
        amount: Number(amount)
      },
      {
        onSuccess: () => {
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
            <SelectSheet id="qb-venue" value={venueId} onChange={(e) => { setVenueId(e.target.value); setCourtId(""); setStartAt(""); }}>
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
            <Input id="qb-date" type="date" value={dateKey} onChange={(e) => { setDateKey(e.target.value); setCourtId(""); setStartAt(""); }} />
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
                onChange={(e) => { setCourtId(e.target.value); setStartAt(""); }}
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

          {courtId && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Start time</span>
              {availableSlots.length === 0 ? (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
                  No available slots on this day.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.slice(0, 9).map((s) => (
                    <button
                      key={s.start_at}
                      type="button"
                      onClick={() => pickSlot(s)}
                      className={`flex items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        startAt === s.start_at
                          ? "border-primary bg-primary-light text-primary"
                          : "border-border bg-surface text-ink hover:border-ink-3"
                      }`}
                    >
                      {formatTime12(s.start_at)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="qb-name" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Player name (optional)
              </label>
              <Input id="qb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="qb-phone" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Phone (optional)
              </label>
              <Input id="qb-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07X XXX XXXX" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="qb-amount" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Amount (LKR)
            </label>
            <Input id="qb-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            {pricePerSlot > 0 && (
              <p className="text-xs text-ink-3">Court price: {formatLkr(pricePerSlot)}</p>
            )}
          </div>

          {failure && (
            <div className="rounded-2xl bg-error-light px-4 py-3 text-sm text-error">{failure.message}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={manual.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} loading={manual.isPending} disabled={!canSubmit}>
              Confirm booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
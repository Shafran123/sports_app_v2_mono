"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, Input } from "@spots/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@spots/utils";
import { toApiFailure } from "@spots/api";
import type { CourtAvailability, Slot } from "@spots/types";
import { SHEET_CLASS } from "./dialog-sheet";
import { useManualBooking } from "./use-manual-booking";

export function ManualBookingDialog({
  open,
  onOpenChange,
  venueId,
  dateKey,
  venueName,
  court,
  slot,
  onRefresh
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string | undefined;
  dateKey: string;
  venueName: string | undefined;
  court: CourtAvailability | null;
  slot: Slot | null;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const manual = useManualBooking(venueId, dateKey);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setAmount(court && slot ? String(court.price_per_slot) : "");
      manual.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, court?.court_id, slot?.start_at]);

  const failure = manual.error ? toApiFailure(manual.error) : null;
  const slotTaken = failure?.status === 409;
  const canSubmit = !!court && !!slot && name.trim().length > 0 && amount.trim().length > 0 && Number(amount) > 0;

  const submit = () => {
    if (!court || !slot || !canSubmit) return;
    manual.mutate(
      {
        court_id: court.court_id,
        start_at: slot.start_at,
        end_at: slot.end_at,
        player_name: name.trim() || undefined,
        player_phone: phone.trim() || undefined,
        amount: Number(amount)
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && manual.reset()}>
      <DialogContent
        className={SHEET_CLASS}
        title="Walk-in booking"
        description={slot ? `${venueName ?? "Court"} · ${formatDateLong(slot.start_at)}` : undefined}
        onClose={() => manual.reset()}
      >
        {court && slot && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {court.name} · {formatTime12(slot.start_at)}–{formatTime12(slot.end_at)}
              </p>
              <p className="mt-1 text-xs text-ink-2">
                {formatLkr(court.price_per_slot)} per {court.slot_duration_min} min slot
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="manual-name" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Player name
              </label>
              <Input
                id="manual-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Walk-in player's name"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="manual-phone" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Phone (optional)
              </label>
              <Input
                id="manual-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07X XXX XXXX"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="manual-amount" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Amount (LKR)
              </label>
              <Input
                id="manual-amount"
                type="number"
                inputMode="numeric"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {failure && (
              <div className="rounded-2xl bg-error-light px-4 py-3 text-sm text-error">
                {slotTaken ? (
                  <>
                    Slot was just taken — <button onClick={onRefresh} className="font-semibold underline">refresh</button> to
                    see the latest availability.
                  </>
                ) : (
                  failure.message
                )}
              </div>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
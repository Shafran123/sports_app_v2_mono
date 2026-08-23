"use client";

import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarX2, ShieldCheck } from "lucide-react";
import { events } from "@myslot/api";
import { Button, Card, Dialog, DialogContent } from "@myslot/ui";
import type { Event } from "@myslot/types";

export function OrganizerTools({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => events.cancel(event.id),
    onSuccess: () => {
      setOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["event", event.id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: () => {
      setError("We could not cancel this event. Please try again.");
    }
  });

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold tracking-tight text-ink">Organizer tools</h3>
          <p className="mt-1 text-sm text-ink-2">Cancel the event if it can't run as planned.</p>
        </div>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Manage
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Cancel this event?"
          description="Registered players will be notified. This action cannot be undone."
          onClose={() => setOpen(false)}
        >
          <p className="text-sm text-ink-2">
            Are you sure you want to cancel <span className="font-semibold text-ink">{event.title}</span>?
          </p>
          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-error">
              <CalendarX2 className="h-4 w-4" /> {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep event
            </Button>
            <Button variant="destructive" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              <ShieldCheck className="h-4 w-4" /> Cancel event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
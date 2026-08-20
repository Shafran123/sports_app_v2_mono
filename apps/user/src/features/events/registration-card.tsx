"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Ticket } from "lucide-react";
import { events } from "@spots/api";
import { Button, Card, Progress, buttonVariants } from "@spots/ui";
import { formatLkr } from "@spots/utils";
import { cn } from "@spots/utils";
import type { Event, User } from "@spots/types";
import { PayHereForm } from "./payhere-form";

function splitName(name: string | null): { first_name: string; last_name: string } {
  const [first = "", ...rest] = (name ?? "").trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") };
}

export function RegistrationCard({ event, user }: { event: Event; user: User | null }) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capacity = Number(event.capacity) || 0;
  const registered = Number(event.registrations_count) || 0;
  const full = capacity > 0 && registered >= capacity;
  const cancelled = event.status === "cancelled";
  const spotsPct = capacity > 0 ? (registered / capacity) * 100 : 0;
  const left = Math.max(0, capacity - registered);
  const almostFull = capacity > 0 && !full && left / capacity < 0.25;

  const mutation = useMutation({
    mutationFn: () => events.register(event.id),
    onSuccess: (result) => {
      if (result.payment_params && Object.keys(result.payment_params).length > 0) {
        setPayment(result.payment_params);
      } else {
        setSuccess(true);
      }
    },
    onError: () => {
      setError("We could not complete your registration. Please try again.");
    }
  });

  const register = () => {
    setError(null);
    mutation.mutate();
  };

  if (payment) {
    const { first_name, last_name } = splitName(user?.name ?? null);
    return (
      <PayHereForm
        payment={payment}
        amount={event.price}
        currency="LKR"
        buyer={{
          first_name,
          last_name,
          email: user?.email ?? "",
          phone: user?.phone ?? "",
          city: user?.city ?? ""
        }}
      />
    );
  }

  if (success) {
    return (
      <Card className="p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">You're in!</h3>
        <p className="mt-1 text-sm text-ink-2">Check your email for your registration confirmation.</p>
        <Link href="/bookings" className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-5 w-full")}>
          View my bookings
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {cancelled && (
        <div className="mb-4 rounded-2xl border border-error/20 bg-error-light/40 px-4 py-2.5 text-sm font-semibold text-error">
          This event has been cancelled.
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <p className="text-sm text-ink-2">Per player</p>
        <p className="font-display text-3xl font-extrabold tracking-tight text-ink">
          {event.price > 0 ? formatLkr(event.price) : "Free"}
        </p>
      </div>

      {capacity > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-ink-2">
            <span>{registered} of {capacity} spots</span>
            <span>{Math.round(spotsPct)}%</span>
          </div>
          <Progress value={spotsPct} tone={full || almostFull ? "warning" : "primary"} className="mt-1.5" />
          {!full && almostFull && (
            <p className="mt-1.5 text-sm font-semibold text-warning">Only {left} {left === 1 ? "spot" : "spots"} left!</p>
          )}
        </div>
      )}

      <div className="mt-5">
        {!user ? (
          <Link href="/register" className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}>
            <Ticket className="h-4 w-4" /> Register →
          </Link>
        ) : cancelled ? (
          <Button className="w-full" disabled>
            Register →
          </Button>
        ) : full ? (
          <Button className="w-full" disabled>
            Full
          </Button>
        ) : (
          <Button className="w-full" loading={mutation.isPending} onClick={register}>
            Register →
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </Card>
  );
}
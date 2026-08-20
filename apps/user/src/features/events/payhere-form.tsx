"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { Button, Card } from "@spots/ui";
import { formatLkr } from "@spots/utils";

const PAYHERE_CHECKOUT_URL = "https://sandbox.payhere.com/pay/checkout";

export interface Payer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

export function PayHereForm({
  payment,
  amount,
  currency = "LKR",
  buyer
}: {
  payment: Record<string, unknown>;
  amount?: number;
  currency?: string;
  buyer: Payer;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <Card className="p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
        <CreditCard className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">Secure payment</h3>
      <p className="mt-1 text-sm text-ink-2">
        {amount !== undefined ? `You'll be charged ${formatLkr(amount)} ${currency}. ` : ""}
        Redirecting you to the payment gateway…
      </p>

      <form ref={formRef} method="POST" action={PAYHERE_CHECKOUT_URL} className="hidden">
        {Object.entries(payment).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={String(value ?? "")} />
        ))}
        <input type="hidden" name="first_name" value={buyer.first_name} />
        <input type="hidden" name="last_name" value={buyer.last_name} />
        <input type="hidden" name="email" value={buyer.email} />
        <input type="hidden" name="phone" value={buyer.phone} />
        <input type="hidden" name="address" value={buyer.address} />
        <input type="hidden" name="city" value={buyer.city} />
        <input type="hidden" name="country" value={buyer.country} />
      </form>

      <Button
        variant="secondary"
        size="sm"
        className="mt-5 w-full"
        onClick={() => formRef.current?.submit()}
      >
        <Loader2 className="h-4 w-4" /> Continue to payment <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}
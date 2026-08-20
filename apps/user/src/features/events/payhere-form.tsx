"use client";

import { useEffect } from "react";
import { ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { Button, Card } from "@spots/ui";
import { formatLkr } from "@spots/utils";
import { submitPayHere, type PayHereUserFields } from "@spots/api";

export function PayHereForm({
  payment,
  amount,
  currency = "LKR",
  buyer
}: {
  payment: Record<string, unknown>;
  amount?: number;
  currency?: string;
  buyer: PayHereUserFields;
}) {
  useEffect(() => {
    submitPayHere(payment, buyer);
  }, [payment, buyer]);

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

      <Button
        variant="secondary"
        size="sm"
        className="mt-5 w-full"
        onClick={() => submitPayHere(payment, buyer)}
      >
        <Loader2 className="h-4 w-4" /> Continue to payment <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}
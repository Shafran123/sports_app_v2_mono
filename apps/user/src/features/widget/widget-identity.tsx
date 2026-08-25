"use client";

// The widget's unified identity step (ADR-0028, ticket 03): one "enter phone →
// OTP" flow whose confirm links an existing Player or auto-creates a fresh
// verified one. The backend hands back a custom token the client signs in
// with, so the rest of the booking stack (QR, reminders, history) works
// exactly as it does in the app.

import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { widget, auth as authApi, toApiFailure } from "@myslot/api";
import { loginWithCustomToken } from "@myslot/auth";
import { Button, Input } from "@myslot/ui";
import { useAuth } from "@/context/auth";

const RESEND_SECONDS = 60;

// Mirrors the backend's LK formatting: bare local numbers (077 123 4567) and
// already-E.164 numbers both work; anything unmatchable is rejected before an
// SMS is burned.
function widgetPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const e164 = digits.startsWith("94")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+94${digits.slice(1)}`
      : `+94${digits}`;
  return e164.length >= 10 && e164.length <= 15 ? e164 : null;
}

export function WidgetIdentity({
  widgetKey,
  onDone
}: {
  widgetKey?: string;
  onDone: () => void;
}) {
  const { user, setUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [sent, setSent] = useState(false);

  const send = useMutation({
    mutationFn: () => {
      const normalized = widgetPhone(phone) ?? phone;
      return widgetKey
        ? widget.phoneSend(widgetKey, normalized)
        : widget.phoneSendKeyless(normalized);
    },
    onSuccess: () => {
      setSent(true);
      setError("");
      setResendIn(RESEND_SECONDS);
    },
    onError: (err) => setError(toApiFailure(err).message)
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const normalized = widgetPhone(phone) ?? phone;
      const res = widgetKey
        ? await widget.phoneConfirm(widgetKey, normalized, code.trim())
        : await widget.phoneConfirmKeyless(normalized, code.trim());
      await loginWithCustomToken(res.token);
      // The AuthProvider's onAuthStateChanged will settle a moment later;
      // set the user now so the booking step unlocks without a reload.
      try {
        const me = await authApi.me();
        setUser(me);
      } catch {
        // Fire-and-forget: the watcher re-derives the user on its own.
      }
      return res;
    },
    onSuccess: () => onDone(),
    onError: (err) => setError(toApiFailure(err).message)
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const normalized = widgetPhone(phone);
    if (!normalized) {
      setError("Enter a valid phone number (077 123 4567).");
      return;
    }
    send.mutate();
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    confirm.mutate();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">Verify to book</h3>
        <p className="mt-0.5 text-sm text-ink-2">
          Enter your mobile number — we&apos;ll text you a code. A MySlot.LK account is created for
          you automatically so your booking (and QR) stay with your number.
        </p>
      </div>

      {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}

      {!sent ? (
        <form onSubmit={submitPhone} className="space-y-3">
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="077 123 4567"
            autoFocus
          />
          <Button type="submit" loading={send.isPending} className="w-full">
            {send.isPending ? "Sending code…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-3">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            autoFocus
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
          <Button type="submit" loading={confirm.isPending} className="w-full">
            {confirm.isPending ? "Verifying…" : "Verify & book"}
          </Button>
          {user ? (
            <p className="text-center text-xs text-ink-3">
              Signed in as <span className="font-medium text-ink-2">{user.name || user.phone || user.email}</span>
            </p>
          ) : null}
          <button
            type="button"
            disabled={resendIn > 0}
            onClick={() => send.mutate()}
            className="mx-auto block text-xs font-medium text-primary underline-offset-2 hover:underline disabled:text-ink-3 disabled:no-underline"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </form>
      )}
    </div>
  );
}
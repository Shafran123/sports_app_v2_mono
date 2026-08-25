"use client";

import * as React from "react";
import { auth as authApi, toApiFailure } from "@myslot/api";
import { Button, Dialog, DialogContent, Input } from "@myslot/ui";
import type { User } from "@myslot/types";
import { useAuth } from "@/context/auth";

interface VerifyEmailModalProps {
  open: boolean;
  initialEmail?: string | null;
  onClose: () => void;
  onVerified?: (user: User) => void;
}

export function VerifyEmailModal({ open, initialEmail, onClose, onVerified }: VerifyEmailModalProps) {
  const { setUser } = useAuth();
  const [email, setEmail] = React.useState("");
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resendAfter, setResendAfter] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setEmail(initialEmail ?? "");
    setStep("email");
    setCode("");
    setError("");
    setResendAfter(0);
  }, [open, initialEmail]);

  React.useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(
      () => setResendAfter((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authApi.verifyEmailSend(trimmed);
      setResendAfter(result.resend_after_seconds);
      setStep("code");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendCode();
  };

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const me = await authApi.verifyEmailConfirm(email.trim(), code.trim());
      setUser(me);
      onVerified?.(me);
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      {open && (
        <DialogContent
          title="Verify your email"
          description="We&apos;ll email you a 6-digit code. Verified emails receive booking confirmations and your check-in QR."
          onClose={onClose}
        >
          {error && (
            <div
              className="mt-4 rounded-2xl border border-error bg-error-light px-4 py-3 text-sm font-medium text-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {step === "email" ? (
            <form className="mt-5 space-y-4" onSubmit={handleSend}>
              <Input
                type="email"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-12"
              />
              <Button type="submit" className="w-full" loading={busy}>
                {busy ? "Sending…" : "Send verification code"}
              </Button>
            </form>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleConfirm}>
              <Input
                type="text"
                aria-label="Verification code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-12 text-center tracking-[0.4em]"
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  type="button"
                  disabled={resendAfter > 0 || busy}
                  onClick={sendCode}
                  className="flex-1"
                >
                  {resendAfter > 0 ? `Resend in ${resendAfter}s` : "Resend code"}
                </Button>
                <Button type="submit" className="flex-1" loading={busy}>
                  {busy ? "Verifying…" : "Verify & continue"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

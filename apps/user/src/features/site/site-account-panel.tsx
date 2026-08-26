"use client";

// Site Customer sign-in for the Dedicated Site header (ADR-0030): tabs for
// sign-in / create account, per-Business OTP verification for the booking
// gates, and a signed-in state with logout. Sessions persist as a bearer
// token — the API client sends it on every owner-surface request.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { siteCustomerAuth, persistSiteToken, toApiFailure } from "@myslot/api";
import type { BusinessInfo } from "@myslot/types";
import { Button, Dialog, DialogContent, Input, PasswordInput } from "@myslot/ui";
import { LogOut, User } from "lucide-react";

type Mode = "signin" | "register";

export function SiteAccountPanel({ business, onDark = false }: { business: BusinessInfo; onDark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cellphone, setCellphone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"auth" | "phone" | "email">("auth");
  const [signedIn, setSignedIn] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const hostname = typeof window !== "undefined" ? window.location.hostname : business.id;

  const sessionFrom = async (res: { token: string; customer: { name: string | null; email: string; phone_verified_at: string | null; email_verified_at: string | null } }) => {
    persistSiteToken(res.token);
    setSignedIn(res.customer.name || res.customer.email);
    setVerifiedPhone(!!res.customer.phone_verified_at);
    setVerifiedEmail(!!res.customer.email_verified_at);
    router.refresh();
  };

  const submitAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res =
        mode === "register"
          ? await siteCustomerAuth.register({ site_hostname: hostname, name, email, password })
          : await siteCustomerAuth.login({ site_hostname: hostname, email, password });
      await sessionFrom(res);
      setStep("phone");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const sendPhone = async () => {
    setError("");
    setNotice("");
    try {
      await siteCustomerAuth.verifyPhoneSend(cellphone);
      setNotice(`Code sent to ${cellphone}.`);
      setCode("");
    } catch (err) {
      setError(toApiFailure(err).message);
    }
  };

  const confirmPhone = async () => {
    setError("");
    try {
      await siteCustomerAuth.verifyPhoneConfirm(cellphone, code);
      setVerifiedPhone(true);
      setStep("email");
      setNotice("");
    } catch (err) {
      setError(toApiFailure(err).message);
    }
  };

  const sendEmail = async () => {
    setError("");
    setNotice("");
    try {
      await siteCustomerAuth.verifyEmailSend(email);
      setNotice(`Code sent to ${email}.`);
      setCode("");
    } catch (err) {
      setError(toApiFailure(err).message);
    }
  };

  const confirmEmail = async () => {
    setError("");
    try {
      await siteCustomerAuth.verifyEmailConfirm(email, code);
      setVerifiedEmail(true);
      setOpen(false);
      setNotice("");
      router.refresh();
    } catch (err) {
      setError(toApiFailure(err).message);
    }
  };

  const logout = async () => {
    try {
      await siteCustomerAuth.logout();
    } finally {
      persistSiteToken(null);
      setSignedIn(null);
      setVerifiedPhone(false);
      setVerifiedEmail(false);
      setStep("auth");
      router.refresh();
    }
  };

  return (
    <div className="relative">
      {signedIn ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={
              onDark
                ? "flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
                : "flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
            }
          >
            <User className="h-4 w-4" /> <span className="max-w-28 truncate">{signedIn}</span>
          </button>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => void logout()}
            className={`rounded-full p-2 transition-colors ${onDark ? "text-white/70 hover:text-white" : "text-ink-3 hover:text-error"}`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setOpen(true);
          }}
          className={
            onDark
              ? "rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
              : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
          }
        >
          Sign in
        </button>
      )}

{open && signedIn && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent title="Your account">
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between text-ink-2">
                Phone{" "}
                <span className={verifiedPhone ? "font-semibold text-success" : "text-ink-3"}>
                  {verifiedPhone ? "Verified" : "Unverified"}
                </span>
              </p>
              <p className="flex items-center justify-between text-ink-2">
                Email{" "}
                <span className={verifiedEmail ? "font-semibold text-success" : "text-ink-3"}>
                  {verifiedEmail ? "Verified" : "Unverified"}
                </span>
              </p>
              {(!verifiedPhone || !verifiedEmail) && (
                <p className="mt-2 rounded-xl bg-warning-light px-3 py-2 text-xs text-warning">
                  Verify both to book.
                </p>
              )}
              <Button size="sm" className="mt-2 w-full" onClick={() => setStep(verifiedPhone ? "email" : "phone")}>
                Verify for booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {open && !signedIn && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent title={step === "auth" ? (mode === "signin" ? "Sign in" : "Create account") : step === "phone" ? "Verify your phone" : "Verify your email"}>
            {step === "auth" && (
              <form onSubmit={(e) => void submitAuth(e)} className="mt-3 space-y-3">
                <div className="flex gap-1 rounded-full bg-surface-2 p-1">
                  {(["signin", "register"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === m ? "bg-surface text-ink shadow-soft" : "text-ink-3"}`}
                    >
                      {m === "signin" ? "Sign in" : "Create account"}
                    </button>
                  ))}
                </div>
                {mode === "register" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">Name</span>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-2">Email</span>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-2">Password</span>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
                <Button type="submit" className="w-full" loading={busy} disabled={!email.trim() || password.length < 8}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
            )}

            {step === "phone" && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-2">Phone</span>
                  <Input value={cellphone} onChange={(e) => setCellphone(e.target.value)} placeholder="+94 77 123 4567" />
                </label>
                {notice && <p className="text-xs text-success">{notice}</p>}
                <Button type="button" size="sm" variant="secondary" onClick={() => void sendPhone()}>Send code</Button>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
                {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
                <Button type="button" className="w-full" disabled={!code} onClick={() => void confirmPhone()}>Confirm</Button>
              </div>
            )}

            {step === "email" && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-ink-2">We sent a code to {email} on sign-in.</p>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
                {notice && <p className="text-xs text-success">{notice}</p>}
                {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
                <Button type="button" className="w-full" disabled={!code} onClick={() => void confirmEmail()}>Confirm &amp; continue</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
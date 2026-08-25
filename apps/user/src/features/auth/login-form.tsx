"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toApiFailure } from "@myslot/api";
import { Button, BrandLockup, Input, PasswordInput } from "@myslot/ui";
import { loginWithEmail, sendPasswordReset } from "@myslot/auth";
import { VerifyPhoneModal } from "@/features/verify-phone/verify-phone-modal";
import { useGoogleVerify } from "@/features/verify-phone/use-google-verify";
import { useBrandName } from "@/hooks/use-brand-name";

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/too-many-requests": "Too many attempts. Try again in a minute.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/invalid-verification-code": "Incorrect code. Check and try again.",
  "auth/invalid-phone-number": "Enter a valid phone number with country code.",
  "auth/missing-phone-number": "Enter your phone number.",
  "auth/session-expired": "Code expired. Request a new one.",
  "auth/quota-exceeded": "SMS limit reached. Try again later.",
  "auth/captcha-check-failed": "Verification failed. Try again.",
  "auth/operation-not-allowed": "Phone login is not available yet."
};

function messageFor(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && FIREBASE_MESSAGES[code]) return FIREBASE_MESSAGES[code];
  }
  return toApiFailure(error).message;
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const brand = useBrandName();
  const { login: loginViaGoogle, verifyOpen, closeVerify, busy: googleBusy } = useGoogleVerify(() =>
    router.push("/dashboard")
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    try {
      await loginViaGoogle();
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function handleForgot() {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you signed up with.");
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setError("");
      window.alert("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-soft animate-fade-up sm:p-8">
      <div className="text-center">
        <p className="font-display text-3xl font-extrabold tracking-tight text-ink">
          <BrandLockup brand={brand} />
        </p>
        <p className="mt-2 text-sm text-ink-3">Welcome back. Find your game.</p>
      </div>

      {error ? (
        <div
          className="mt-6 rounded-2xl border border-error bg-error-light px-4 py-3 text-sm font-medium text-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form className="mt-4 space-y-4" onSubmit={handleEmailSubmit} noValidate>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="h-12"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Password</span>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-12"
          />
        </label>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleForgot}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Forgot password?
          </button>
          <Button type="submit" size="lg" className="px-6" loading={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </div>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-3">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" size="lg" className="w-full" onClick={handleGoogle} loading={googleBusy}>
        <GoogleGlyph />
        Continue with Google
      </Button>

      <div className="mt-6 text-center text-sm">
        <span className="text-ink-3">New to {brand}?</span>{" "}
        <Link
          href="/register"
          className="font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          Register
        </Link>
      </div>
      <div className="mt-3 text-center">
        <Link href="/admin" className="text-xs text-ink-3 transition-colors hover:text-ink-2">
          Admin login
        </Link>
      </div>

      <VerifyPhoneModal open={verifyOpen} onClose={closeVerify} onVerified={() => router.push("/dashboard")} />
    </section>
  );
}
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toApiFailure } from "@spots/api";
import { Button, Input, PasswordInput } from "@spots/ui";
import { loginWithEmail } from "@spots/auth";

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/too-many-requests": "Too many attempts. Try again in a minute.",
  "auth/user-disabled": "This account has been disabled."
};

function messageFor(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && FIREBASE_MESSAGES[code]) return FIREBASE_MESSAGES[code];
  }
  return toApiFailure(error).message;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail(email.trim(), password);
      router.push("/");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-soft animate-fade-up sm:p-8">
      <div className="text-center">
        <p className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Spots<span className="text-primary">.</span> Console
        </p>
        <p className="mt-2 text-sm text-ink-3">Staff &amp; venue owners</p>
      </div>

      {error && (
        <div
          className="mt-6 rounded-2xl border border-error bg-error-light px-4 py-3 text-sm font-medium text-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
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
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-3">
        Staff only — players log in at the player app.
      </p>
    </section>
  );
}
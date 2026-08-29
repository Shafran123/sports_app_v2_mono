"use client";

// The widget's identity step (cutover): the app's sign-in surface, in the
// iframe. Email+password or Google (Firebase redirect — popups are blocked in
// cross-origin frames) with inline registration and a password-reset link.
// No phone sign-in: phone is only ever a Verified Phone attribute.
//
// After sign-in, a details step collects whatever the booking gate requires:
// name, a Verified Phone (SMS OTP) and a Verified Email (email OTP; a
// Google-verified email is already Verified Email — no OTP). The booking only
// creates once phone AND email are verified (ADR-0033: the gate sits at the
// confirm step, not before the picker).

import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { auth as authApi, toApiFailure, featureFlags, siteCustomerAuth, persistSiteToken, SITE_GOOGLE_PENDING_KEY } from "@myslot/api";
import type { SiteAuthChallenge } from "@myslot/types";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogleRedirect,
  loginWithGooglePopup,
  sendPasswordReset,
  logoutFirebase
} from "@myslot/auth";
import { Button, Input, PasswordInput } from "@myslot/ui";
import { DEFAULT_BRAND_NAME, getRecaptchaToken } from "@myslot/utils";
import { useAuth } from "@/context/auth";
import { GoogleLogo, VerifiedDetails } from "./identity-parts";

type Phase = "signin" | "register" | "details" | "challenge";

// Map a Site Customer onto the app user shape (ADR-0030): the booking gate
// reads the same verified flags + name/phone/email fields.
function toAppUser(customer: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
}) {
  return {
    id: customer.id,
    role: "player" as const,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    city: null,
    phone_verified_at: customer.phone_verified_at,
    email_verified_at: customer.email_verified_at ?? null,
    onboarding_state: "grandfathered" as const
  };
}

function isChallenge(result: SiteAuthChallenge | { token: string }): result is SiteAuthChallenge {
  return (result as SiteAuthChallenge).escalated === true;
}

export function WidgetIdentity({
  widgetKey,
  siteHostname,
  siteName,
  onDone,
  hideIntro = false
}: {
  widgetKey?: string;
  siteHostname?: string | null;
  siteName?: string | null;
  onDone: () => void;
  hideIntro?: boolean;
}) {
  const { user, setUser } = useAuth();
  // ADR-0030: when the Business has a live Dedicated Site, the widget signs
  // the buyer in as a Site Customer of that Business (own auth, per-Business
  // verified gates). Without a live site the platform (Firebase) flow stays.
  const siteMode = Boolean(siteHostname);
  // The Anti-bot Check (ticket 05) runs only on first-party Dedicated Site
  // surfaces — never inside the widget iframe (ADR-0042). The widget is the
  // only caller that passes a widgetKey; the site surfaces never do.
  const firstPartySite = siteMode && !widgetKey;
  const [phase, setPhase] = useState<Phase>(user ? "details" : "signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Email + password sign-in
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Inline registration
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Anti-bot escalation (low-score sign-in/register -> email-OTP challenge)
  const [challenge, setChallenge] = useState<SiteAuthChallenge | null>(null);
  const [challengeCode, setChallengeCode] = useState("");
  const [challengeFrom, setChallengeFrom] = useState<"signin" | "register">("signin");

  // Details step (phone + email verification)
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [detailsEmail, setDetailsEmail] = useState(user?.email ?? "");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // ---- Sign-in / register ----

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (siteMode) {
        const captcha_token = firstPartySite ? await getRecaptchaToken("site_login") : undefined;
        const result = await siteCustomerAuth.login({
          site_hostname: siteHostname!,
          email: email.trim(),
          password,
          captcha_token
        });
        if (isChallenge(result)) {
          setChallenge(result);
          setChallengeCode("");
          setChallengeFrom("signin");
          setPhase("challenge");
          return;
        }
        persistSiteToken(result.token);
        setUser(toAppUser(result.customer));
      } else {
        await loginWithEmail(email.trim(), password);
        const me = await authApi.me();
        setUser(me);
      }
      setPhase("details");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regName.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(regEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (siteMode) {
        const captcha_token = firstPartySite ? await getRecaptchaToken("site_register") : undefined;
        const result = await siteCustomerAuth.register({
          site_hostname: siteHostname!,
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          captcha_token
        });
        if (isChallenge(result)) {
          setChallenge(result);
          setChallengeCode("");
          setChallengeFrom("register");
          setPhase("challenge");
          return;
        }
        persistSiteToken(result.token);
        setUser(toAppUser(result.customer));
      } else {
        await registerWithEmail(regEmail.trim(), regPassword);
        await authApi.updateMe(undefined, { name: regName.trim() });
        const me = await authApi.me();
        setUser(me);
      }
      setPhase("details");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  // Complete an escalated sign-in/register: the code from the inbox proves
  // the human controls the email, then the session is issued.
  const confirmChallenge = async () => {
    if (!challenge) return;
    if (!/^\d{6}$/.test(challengeCode)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await siteCustomerAuth.confirmChallenge(challenge.challenge_id, challengeCode.trim());
      persistSiteToken(session.token);
      setUser(toAppUser(session.customer));
      setPhase("details");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      if (siteMode) {
        if (widgetKey) {
          // Site-mode widget embed: the iframe blocks popups, so the redirect
          // flow runs and the embed settles the sign-in on return (ADR-0030).
          // Stash the hostname it needs to resolve the Site Customer.
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(SITE_GOOGLE_PENDING_KEY, siteHostname!);
          }
          await loginWithGoogleRedirect();
        } else {
          // Dedicated Site (first-party): popups are allowed, so resolve the
          // Google identity as THIS Business's Site Customer inline — never a
          // platform Player (ADR-0030).
          const { idToken } = await loginWithGooglePopup();
          const session = await siteCustomerAuth.google({ site_hostname: siteHostname!, id_token: idToken });
          persistSiteToken(session.token);
          setUser(toAppUser(session.customer));
          setPhase("details");
        }
      } else {
        // Marketplace / non-live-site widget: the platform (Firebase) flow.
        await loginWithGoogleRedirect();
      }
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setError("");
      alert("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Details: name / phone-OTP / email-OTP ----

  const saveName = async () => {
    if (!name.trim()) throw new Error("Enter your name.");
    // Site Customers capture their name at registration; the platform user
    // (marketplace path) updates via /auth/me.
    if (!siteMode && name.trim() !== (user?.name ?? "")) {
      await authApi.updateMe(undefined, { name: name.trim() });
      const me = await authApi.me();
      setUser(me);
    }
    return user;
  };

  const phoneReady = !!user?.phone_verified_at;
  const emailReady = !!user?.email_verified_at;

  const sendPhone = async () => {
    setError("");
    const normalized = phone.trim();
    if (!/^\+?\d[\d\s()-]{7,14}$/.test(normalized)) {
      setError("Enter a valid phone number (077 123 4567 or +94…).");
      return;
    }
    setBusy(true);
    try {
      if (siteMode) {
        await siteCustomerAuth.verifyPhoneSend(normalized);
      } else {
        const result = await authApi.verifyPhoneSend(normalized);
        setResendIn(result.resend_after_seconds);
      }
      setPhoneSent(true);
      setError("");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmPhone = async () => {
    if (!/^\d{6}$/.test(phoneCode)) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    setBusy(true);
    try {
      if (siteMode) {
        await siteCustomerAuth.verifyPhoneConfirm(phone.trim(), phoneCode.trim());
        const customer = await siteCustomerAuth.me();
        setUser(toAppUser(customer));
      } else {
        const me = await authApi.verifyPhoneConfirm(phone.trim(), phoneCode.trim());
        setUser(me);
      }
      setPhoneCode("");
      setError("");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(detailsEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      if (siteMode) {
        await siteCustomerAuth.verifyEmailSend(detailsEmail.trim());
      } else {
        const result = await authApi.verifyEmailSend(detailsEmail.trim());
        setResendIn(result.resend_after_seconds);
      }
      setEmailSent(true);
      setError("");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmEmail = async () => {
    if (!/^\d{6}$/.test(emailCode)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    try {
      if (siteMode) {
        await siteCustomerAuth.verifyEmailConfirm(detailsEmail.trim(), emailCode.trim());
        const customer = await siteCustomerAuth.me();
        setUser(toAppUser(customer));
      } else {
        const me = await authApi.verifyEmailConfirm(detailsEmail.trim(), emailCode.trim());
        setUser(me);
      }
      setEmailCode("");
      setError("");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setError("");
    try {
      await saveName();
      if (!phoneReady && !user?.phone_verified_at) {
        // Requires the phone-OTP challenge first.
        setError("Verify your phone to continue.");
        return;
      }
      if (!emailReady && !user?.email_verified_at) {
        setError("Verify your email to continue.");
        return;
      }
      onDone();
    } catch (err) {
      setError(toApiFailure(err).message);
    }
  };

  const allVerified =
    !!user?.phone_verified_at && !!user?.email_verified_at;

  if (phase === "signin" || phase === "register") {
    return (
      <div className="space-y-4">
        {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error" role="alert">{error}</p>}

        {phase === "signin" ? (
          <>
            {!hideIntro && (
              <div>
                <h3 className="pt-3 font-display text-lg font-extrabold tracking-tight text-ink">Sign in to book</h3>
                <p className="mt-0.5 text-sm text-ink-2">
                  {siteMode
                    ? siteName
                      ? `Use your ${siteName} account to book.`
                      : "Use your account at this venue to book."
                    : `Use your ${DEFAULT_BRAND_NAME} account — the same one you use in the app.`}
                </p>
              </div>
            )}

            <form className="space-y-3" onSubmit={handleEmailLogin} noValidate>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={busy}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:text-ink-3"
                >
                  Forgot password?
                </button>
                <Button type="submit" loading={busy} className="w-auto px-6">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </div>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-3">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="secondary" className="w-full" onClick={handleGoogle} loading={busy}>
              <GoogleLogo />
              Continue with Google
            </Button>

            <p className="pt-2 text-center text-xs text-ink-3">
              New here?{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPhase("register");
                }}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Create an account
              </button>
            </p>
          </>
        ) : (
          <>
            {!hideIntro && (
              <div>
                <h3 className="pt-3 font-display text-lg font-extrabold tracking-tight text-ink">Create your account</h3>
                <p className="mt-0.5 text-sm text-ink-2">
                  {siteMode
                    ? siteName
                      ? `Create an account at ${siteName} to book.`
                      : "Create an account at this venue to book."
                    : "One account for MySlot.LK — the app, the widget, and more."}
                </p>
              </div>
            )}

            <form className="space-y-3" onSubmit={handleRegister} noValidate>
              <Input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                autoFocus
              />
              <Input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <PasswordInput
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Password (6+ characters)"
                autoComplete="new-password"
              />
              <Button type="submit" loading={busy} className="w-full">
                {busy ? "Creating…" : "Create account"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-3">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="secondary" className="w-full" onClick={handleGoogle} loading={busy}>
              <GoogleLogo />
              Continue with Google
            </Button>

            <p className="pt-2 text-center text-xs text-ink-3">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPhase("signin");
                }}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    );
  }

  if (phase === "challenge") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="pt-3 font-display text-lg font-extrabold tracking-tight text-ink">Verify it&apos;s you</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            We emailed a 6-digit code to <span className="font-semibold text-ink">{challenge?.email}</span>.
            Enter it here to finish {challengeFrom === "register" ? "creating your account" : "signing in"}.
          </p>
        </div>

        {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error" role="alert">{error}</p>}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmChallenge();
          }}
        >
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={challengeCode}
            onChange={(e) => setChallengeCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            autoComplete="one-time-code"
            autoFocus
          />
          <Button type="submit" loading={busy} className="w-full">
            {busy ? "Verifying…" : "Verify"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError("");
            setChallenge(null);
            setPhase(challengeFrom);
          }}
          className="mx-auto block text-xs font-medium text-ink-3 underline-offset-2 hover:underline"
        >
          Use a different method
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error" role="alert">{error}</p>}

      {!hideIntro && (
        <div>
          <h3 className="pt-3 font-display text-lg font-extrabold tracking-tight text-ink">Complete your booking details</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {allVerified ? "All set — you can book." : "We need these before you can book."}
          </p>
        </div>
      )}

      <VerifiedDetails
        name={name}
        onNameChange={setName}
        phone={phone}
        onPhoneChange={setPhone}
        phoneReady={phoneReady}
        phoneSent={phoneSent}
        phoneCode={phoneCode}
        onPhoneCodeChange={setPhoneCode}
        onSendPhone={sendPhone}
        onConfirmPhone={confirmPhone}
        resendIn={resendIn}
        email={detailsEmail}
        onEmailChange={setDetailsEmail}
        emailReady={emailReady}
        emailSent={emailSent}
        emailCode={emailCode}
        onEmailCodeChange={setEmailCode}
        onSendEmail={sendEmail}
        onConfirmEmail={confirmEmail}
      />

      <Button className="w-full" loading={busy} onClick={handleFinish} disabled={!allVerified}>
        {busy ? "Saving…" : "Continue to booking"}
      </Button>

      <button
        type="button"
        onClick={() => {
          void logoutFirebase();
          setUser(null);
          setPhase("signin");
        }}
        className="mx-auto block text-xs font-medium text-ink-3 underline-offset-2 hover:underline"
      >
        Use a different account
      </button>
    </div>
  );
}
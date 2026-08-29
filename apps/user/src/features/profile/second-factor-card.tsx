"use client";

// The Dedicated Site account panel's Second Factor section (tickets 07-09):
// Site Customers enable TOTP from their authenticator app (QR + manual
// secret), see their ten single-use backup codes exactly once, regenerate
// them, and disable the factor. Enrollment lives HERE only — the Booking
// Widget challenges enrolled customers but never enrolls. A Business that
// requires the factor never lets its customers disable it.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { isOwnerSurface, siteCustomerAuth, toApiFailure } from "@myslot/api";
import { Badge, Button, Card, Input } from "@myslot/ui";
import { KeyRound, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import type { User } from "@myslot/types";
import { useAuth } from "@myslot/auth";

type Step = "idle" | "scan" | "codes";

export function SecondFactorCard({
  user,
  onChanged,
  className = ""
}: {
  user: User;
  onChanged: (user: User) => void;
  className?: string;
}) {
  // Site Customer surface only — the marketplace Player base has no factor.
  const [isSite, setIsSite] = useState(false);
  useEffect(() => setIsSite(isOwnerSurface()), []);

  const [step, setStep] = useState<Step>("idle");
  const [enrolling, setEnrolling] = useState(false);
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!isSite) return null;

  const enabled = !!user.totp_enabled;

  const start = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await siteCustomerAuth.totpEnable();
      setSecret(result.secret);
      setQr(await QRCode.toDataURL(result.otpauth_url, { width: 220, margin: 1 }));
      setStep("scan");
      setVerifyCode("");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(verifyCode)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const result = await siteCustomerAuth.totpEnableConfirm(verifyCode.trim());
      setBackupCodes(result.backup_codes);
      setStep("codes");
      onChanged({ ...user, totp_enabled: true });
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!window.confirm("Regenerate your backup codes? The current ones stop working immediately.")) return;
    setError("");
    setBusy(true);
    try {
      const result = await siteCustomerAuth.totpRegenerateBackupCodes();
      setBackupCodes(result.backup_codes);
      setStep("codes");
      setNotice("New backup codes generated — the old ones are dead.");
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!disableCode.trim()) {
      setError("Enter a current code from your authenticator app, or an unused backup code.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await siteCustomerAuth.totpDisable(disableCode.trim());
      setStep("idle");
      setDisableCode("");
      setNotice("Two-factor authentication is off.");
      onChanged({ ...user, totp_enabled: false });
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const doneWithCodes = () => {
    setBackupCodes([]);
    setStep("idle");
    setNotice(
      enabled
        ? "New backup codes saved."
        : "Two-factor authentication is on. Keep your backup codes somewhere safe."
    );
  };

  return (
    <Card className={`p-5 md:p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
              Two-factor authentication
              {enabled ? (
                <Badge variant="success">
                  <ShieldCheck className="h-3 w-3" /> On
                </Badge>
              ) : (
                <Badge variant="neutral">Off</Badge>
              )}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {enabled
                ? "Every sign-in asks for a code from your authenticator app."
                : "Add an authenticator app code to your sign-in for extra security."}
            </p>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-error-light px-3 py-2 text-sm text-error" role="alert">{error}</p>}
      {notice && <p className="mt-4 rounded-xl bg-success-light px-3 py-2 text-sm text-success" role="status">{notice}</p>}

      {!enabled && step === "idle" && (
        <div className="mt-4 space-y-3">
          {user.totp_required && (
            <p className="flex items-start gap-2 rounded-xl bg-warning-light px-3 py-2 text-sm text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This venue requires two-factor authentication — you&apos;ll need to enable it to
                sign in again.
              </span>
            </p>
          )}
          <Button onClick={start} loading={busy}>
            <Smartphone className="h-4 w-4" /> Enable two-factor authentication
          </Button>
        </div>
      )}

      {!enabled && step === "scan" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink-2">
            Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password…),
            or enter this secret manually:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt="Authenticator QR code" className="mx-auto h-56 w-56 rounded-2xl border border-border bg-surface-2 p-2" /> : null}
          <p className="mx-auto max-w-xs break-all rounded-xl bg-surface-2 px-3 py-2 text-center font-mono text-xs text-ink-2">{secret}</p>
          <div className="flex items-center gap-2">
            <Input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              aria-label="Authenticator code"
            />
            <Button onClick={confirm} loading={busy} className="shrink-0">
              {busy ? "Checking…" : "Verify"}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="mx-auto block text-xs font-medium text-ink-3 underline-offset-2 hover:underline"
          >
            Back
          </button>
        </div>
      )}

      {step === "codes" && (
        <div className="mt-4 space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-warning-light px-3 py-2 text-sm text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Save these ten backup codes somewhere safe. Each works exactly once when you can&apos;t
              reach your app — they won&apos;t be shown again.
            </span>
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {backupCodes.map((code) => (
              <li key={code} className="rounded-xl bg-surface-2 px-3 py-2 text-center font-mono text-sm text-ink">
                {code}
              </li>
            ))}
          </ul>
          <Button onClick={doneWithCodes} className="w-full">
            I&apos;ve saved my backup codes
          </Button>
        </div>
      )}

      {enabled && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <Button variant="secondary" size="sm" onClick={regenerate} loading={busy}>
            Regenerate backup codes
          </Button>
          {user.totp_required ? (
            <p className="text-xs text-ink-3">
              This venue requires two-factor authentication, so it can&apos;t be disabled.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9))}
                placeholder="Code to confirm"
                aria-label="Code to confirm disabling"
                className="max-w-44"
              />
              <Button variant="ghost" size="sm" onClick={disable} loading={busy} className="text-error hover:bg-error-light hover:text-error">
                Disable
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
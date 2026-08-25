"use client";

// Small shared pieces for the widget identity step: the Google logo glyph and
// the "VerifiedDetails" form (name + phone-OTP + email-OTP) used after
// sign-in whenever the booking gate isn't satisfied.

import { Button, Input, PasswordInput } from "@myslot/ui";
import { ShieldCheck } from "lucide-react";

export function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.57-5.16 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.93-2.9l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29a7.24 7.24 0 0 1 0-4.58v-3.1H1.29a12 12 0 0 0 0 10.78z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
      />
    </svg>
  );
}

function VerifiedLabel({ ready, onClick }: { ready: boolean; onClick: () => void }) {
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-xs font-semibold text-success">
        <ShieldCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
      Verify
    </button>
  );
}

export function VerifiedDetails({
  name,
  onNameChange,
  phone,
  onPhoneChange,
  phoneReady,
  phoneSent,
  phoneCode,
  onPhoneCodeChange,
  onSendPhone,
  onConfirmPhone,
  resendIn,
  email,
  onEmailChange,
  emailReady,
  emailSent,
  emailCode,
  onEmailCodeChange,
  onSendEmail,
  onConfirmEmail
}: {
  name: string;
  onNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  phoneReady: boolean;
  phoneSent: boolean;
  phoneCode: string;
  onPhoneCodeChange: (v: string) => void;
  onSendPhone: () => void;
  onConfirmPhone: () => void;
  resendIn: number;
  email: string;
  onEmailChange: (v: string) => void;
  emailReady: boolean;
  emailSent: boolean;
  emailCode: string;
  onEmailCodeChange: (v: string) => void;
  onSendEmail: () => void;
  onConfirmEmail: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Name</label>
        <Input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

      {/* Verified Phone */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Verified phone</p>
          <VerifiedLabel ready={phoneReady} onClick={() => undefined} />
        </div>
        {!phoneReady && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="077 123 4567"
                inputMode="tel"
                className="flex-1"
              />
              {!phoneSent ? (
                <Button type="button" variant="secondary" onClick={onSendPhone}>
                  Send code
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={resendIn > 0}
                  onClick={onSendPhone}
                >
                  {resendIn > 0 ? `${resendIn}s` : "Resend"}
                </Button>
              )}
            </div>
            {phoneSent && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneCode}
                  onChange={(e) => onPhoneCodeChange(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="flex-1 text-center font-mono tracking-[0.3em]"
                />
                <Button type="button" onClick={onConfirmPhone}>
                  Verify
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verified Email */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Verified email</p>
          <VerifiedLabel ready={emailReady} onClick={() => undefined} />
        </div>
        {!emailReady && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="flex-1"
              />
              {!emailSent ? (
                <Button type="button" variant="secondary" onClick={onSendEmail}>
                  Send code
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={resendIn > 0}
                  onClick={onSendEmail}
                >
                  {resendIn > 0 ? `${resendIn}s` : "Resend"}
                </Button>
              )}
            </div>
            {emailSent && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) => onEmailCodeChange(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="flex-1 text-center font-mono tracking-[0.3em]"
                />
                <Button type="button" onClick={onConfirmEmail}>
                  Verify
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
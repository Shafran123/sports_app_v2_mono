"use client";

import { useState } from "react";
import { auth as authApi, featureFlags } from "@spots/api";
import { loginWithGoogle } from "@spots/auth";
import { useAuth } from "@/context/auth";

/**
 * Google sign-in that routes unverified accounts into the phone-verify flow —
 * but only while the platform requires a verified phone (feature flag
 * phone_verification_required). When the flag is off, unverified accounts
 * sign in straight through; the server is the source of truth and will
 * reject booking with 409 VERIFIED_PHONE_REQUIRED if the flag flips on.
 * `onDone` runs when the account is already verified (or as soon as the
 * verify modal completes).
 */
export function useGoogleVerify(onDone: () => void) {
  const { setUser } = useAuth();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    try {
      await loginWithGoogle();
      const me = await authApi.me();
      setUser(me);
      if (me.phone_verified_at) {
        onDone();
        return;
      }
      const flags = await featureFlags.get();
      if (flags.phone_verification_required) {
        setVerifyOpen(true);
      } else {
        onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  return { login, verifyOpen, closeVerify: () => setVerifyOpen(false), busy };
}
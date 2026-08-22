"use client";

import { useState } from "react";
import { auth as authApi } from "@spots/api";
import { loginWithGoogle } from "@spots/auth";
import { useAuth } from "@/context/auth";

/**
 * Google sign-in that routes unverified accounts into the phone-verify flow.
 * `onDone` runs when the account is already verified (or as soon as the
 * verify modal completes) — callers navigate/continue there.
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
      } else {
        setVerifyOpen(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return { login, verifyOpen, closeVerify: () => setVerifyOpen(false), busy };
}
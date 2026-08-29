"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  auth as authApi,
  siteCustomerAuth,
  persistSiteToken,
  SITE_CUSTOMER_TOKEN_KEY,
  isOwnerSurface,
  TOKEN_KEY
} from "@myslot/api";
import type { Role, User } from "@myslot/types";
import { watchAuth } from "./firebase";
import { logoutFirebase } from "./firebaseAuth";

interface AuthState {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  logout: async () => {},
  setUser: () => {}
});

// The owner surface (Dedicated Site host / widget embed) signs people in as
// Site Customers (ADR-0030) — our own per-Business accounts, never Firebase.
// Map the Site Customer onto the app's user shape so the existing booking
// flow (venue detail, checkout, holds) works unchanged: same verified gates,
// same session singleton, token transport via the API client's Authorization.
export function toAppUser(customer: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  totp_enabled?: boolean;
  totp_required?: boolean;
}): User {
  return {
    id: customer.id,
    role: "player",
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    city: null,
    phone_verified_at: customer.phone_verified_at,
    email_verified_at: customer.email_verified_at ?? null,
    onboarding_state: "grandfathered",
    totp_enabled: customer.totp_enabled,
    totp_required: customer.totp_required
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOwnerSurface()) {
      const token = window.localStorage.getItem(SITE_CUSTOMER_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      siteCustomerAuth
        .me()
        .then((customer) => setUser(toAppUser(customer)))
        .catch(() => persistSiteToken(null))
        .finally(() => setLoading(false));
      return;
    }

    const unsub = watchAuth(async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        // Derive and persist the token BEFORE calling /auth/me — the watcher can
        // fire before the caller's own persistToken runs, which would send the
        // request without an Authorization header (401 → bounced to /login).
        const token = await fbUser.getIdToken();
        if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
        const me = await authApi.me();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const logout = async () => {
    if (isOwnerSurface()) {
      try {
        await siteCustomerAuth.logout();
      } finally {
        persistSiteToken(null);
        setUser(null);
      }
      return;
    }
    await logoutFirebase();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, setUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Staff roles that may operate the console app. */
export function isStaffRole(role: Role | undefined | null): boolean {
  return role === "admin" || role === "venue_owner";
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/** Redirects to login when unauthenticated; optionally restricts roles. */
export function RequireAuth({
  children,
  allowRoles,
  redirectTo = "/login"
}: {
  children: ReactNode;
  allowRoles?: Role[];
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace(redirectTo);
      else if (allowRoles && !allowRoles.includes(user.role)) router.replace("/");
    }
  }, [loading, user, router, allowRoles, redirectTo]);

  if (loading) return <Spinner />;
  if (!user) return null;
  if (allowRoles && !allowRoles.includes(user.role)) return null;
  return <>{children}</>;
}

/** Console guard: requires an admin or venue_owner session. */
export function RequireStaff({ children, redirectTo = "/login" }: { children: ReactNode; redirectTo?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && ( !user || !isStaffRole(user.role))) {
      router.replace(redirectTo);
    }
  }, [loading, user, router, redirectTo]);

  if (loading) return <Spinner />;
  if (!user || !isStaffRole(user?.role)) return null;
  return <>{children}</>;
}

/** Admin-only guard. */
export function RequireAdmin({ children, redirectTo = "/" }: { children: ReactNode; redirectTo?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace(redirectTo);
    }
  }, [loading, user, router, redirectTo]);

  if (loading) return <Spinner />;
  if (!user || user.role !== "admin") return null;
  return <>{children}</>;
}

/** Owner onboarding guard: redirects a console user whose agreement is pending. */
export function RequireOnboarded({ children, redirectTo = "/plan" }: { children: ReactNode; redirectTo?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pending = user?.role === "venue_owner" && user.onboarding_state === "pending";

  useEffect(() => {
    if (!loading && pending) router.replace(redirectTo);
  }, [loading, pending, router, redirectTo]);

  if (loading) return null;
  if (pending) return null;
  return <>{children}</>;
}
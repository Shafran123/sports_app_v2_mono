"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth as authApi } from "@spots/api";
import type { Role, User } from "@spots/types";
import { watchAuth } from "./firebase";
import { logoutFirebase } from "./firebaseAuth";

interface AuthState {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = watchAuth(async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
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
    await logoutFirebase();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
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
    if (!loading && user && user.role !== "admin") router.replace(redirectTo);
  }, [loading, user, router, redirectTo]);

  if (loading) return null;
  if (!user || user.role !== "admin") return null;
  return <>{children}</>;
}

export function isStaffRole(role: Role | undefined | null): boolean {
  return role === "admin" || role === "venue_owner";
}
"use client";

import { useEffect, useState } from "react";
import { notifications } from "@myslot/api";
import { useAuth } from "./auth-context";

/** Unread notification count, refreshed when the auth user changes. */
export function useUnread(): number {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    notifications
      .list()
      .then((list) => {
        if (!cancelled) setUnread(list.filter((n) => !n.is_read).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  return unread;
}
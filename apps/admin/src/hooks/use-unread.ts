"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { notifications } from "@spots/api";

export function useUnread(): { unread: number } {
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

  return { unread };
}
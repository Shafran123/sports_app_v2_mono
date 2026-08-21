"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/context/auth";
import { TOKEN_KEY } from "@spots/api";

const BOOKING_EVENTS = [
  "booking.created",
  "booking.checked_in",
  "booking.marked_paid",
  "booking.cancelled",
  "booking.no_show"
] as const;

export function eventToQueryKeys(event: string): string[][] {
  switch (event) {
    case "booking.created":
    case "booking.checked_in":
    case "booking.marked_paid":
    case "booking.cancelled":
    case "booking.no_show":
      return [["front-desk-bookings"], ["admin-bookings"], ["admin-availability"]];
    default:
      return [];
  }
}

// Live-updates the owner console when booking state changes push over Socket.IO.
// Without NEXT_PUBLIC_SOCKET_URL the hook is a no-op and the pages keep polling.
export function useRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:2400";
    if (!user) return;

    const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;

    const socket = io(url, { auth: { token } });
    socketRef.current = socket;

    for (const event of BOOKING_EVENTS) {
      socket.on(event, () => {
        for (const key of eventToQueryKeys(event)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      });
    }

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [user, queryClient]);
}

export function RealtimeBridge() {
  useRealtime();
  return null;
}
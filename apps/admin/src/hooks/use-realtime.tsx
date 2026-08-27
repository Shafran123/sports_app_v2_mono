"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/context/auth";
import { TOKEN_KEY } from "@myslot/api";

const BOOKING_EVENTS = [
  "booking.created",
  "booking.confirmed",
  "booking.checked_in",
  "booking.marked_paid",
  "booking.cancelled",
  "booking.no_show"
] as const;

export function eventToQueryKeys(event: string): string[][] {
  switch (event) {
    case "booking.created":
    case "booking.confirmed":
    case "booking.checked_in":
    case "booking.marked_paid":
    case "booking.cancelled":
    case "booking.no_show":
      return [["front-desk-bookings"], ["admin-bookings"], ["admin-availability"]];
    default:
      return [];
  }
}

export type SocketStatus = "connecting" | "connected" | "disconnected";

// The console surfaces (front desk first) need to know whether pushes are
// actually flowing — a silent socket drop means the staff would act on stale
// data. The provider below tracks the Socket.IO lifecycle and the status
// badge renders it; on reconnect the booking queries are re-fetched so any
// update that arrived during the drop is never lost.
const SocketStatusContext = createContext<SocketStatus>("connecting");

export function useSocketStatus(): SocketStatus {
  return useContext(SocketStatusContext);
}

// Live-updates the owner console when booking state changes push over Socket.IO,
// and surfaces the connection state to every descendant so surfaces can show
// "Live" vs "Offline". Without NEXT_PUBLIC_SOCKET_URL the socket never opens
// and status stays "connecting" (pages keep polling).
export function RealtimeBridge({ children }: { children?: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:2400";
    if (!user) return;

    const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;

    const socket = io(url, { auth: { token } });
    socketRef.current = socket;

    setStatus("connecting");
    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));
    socket.on("reconnect", () => {
      setStatus("connected");
      // The connection dropped and pushes for the gap were missed — refetch so
      // nothing is lost.
      for (const key of ["front-desk-bookings", "admin-bookings", "admin-availability"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    });

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

  return <SocketStatusContext.Provider value={status}>{children}</SocketStatusContext.Provider>;
}

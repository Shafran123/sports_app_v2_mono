"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { notifications as notificationsApi, toApiFailure } from "@spots/api";
import { Button, Card, EmptyState, ErrorState, SkeletonRow, Toast } from "@spots/ui";
import { cn, formatDateLong } from "@spots/utils";
import type { Notification } from "@spots/types";
import { useAuth } from "@/context/auth";

interface Feedback {
  tone: "success" | "error";
  title: string;
  message?: string;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    enabled: !!user
  });

  const [marking, setMarking] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const list = data ?? [];
  const unreadCount = list.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    setMarking(id);
    try {
      await notificationsApi.markRead(id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // keep the row unread; the query cache is left intact
    } finally {
      setMarking(null);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setFeedback({ tone: "success", title: "You're all caught up" });
    } catch (err) {
      const failure = toApiFailure(err);
      setFeedback({ tone: "error", title: "Could not mark as read", message: failure.message });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" loading={markingAll} onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {feedback && (
        <div className="mt-4">
          <Toast
            tone={feedback.tone}
            title={feedback.title}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4">
        {!user ? (
          <EmptyState
            title="Sign in to see your notifications"
            message="Log in to stay on top of booking updates and messages."
            actionLabel="Go to login"
            onAction={() => router.replace("/login")}
          />
        ) : isLoading ? (
          [0, 1, 2].map((i) => <SkeletonRow key={i} />)
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            message="No notifications right now. We'll let you know when something needs your attention."
          />
        ) : (
          list.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              marking={marking === notification.id}
              onMarkRead={() => markRead(notification.id)}
            />
          ))
        )}
      </div>
    </main>
  );
}

function NotificationRow({
  notification,
  marking,
  onMarkRead
}: {
  notification: Notification;
  marking: boolean;
  onMarkRead: () => void;
}) {
  const unread = !notification.is_read;
  return (
    <Card className={cn("p-4", unread && "border-l-4 border-l-primary")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm", unread ? "font-semibold text-ink" : "text-ink-3")}>
            {notification.title ?? "Notification"}
          </p>
          {notification.message && (
            <p className={cn("mt-1 text-sm", unread ? "text-ink-2" : "text-ink-3")}>
              {notification.message}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-3">{formatDateLong(notification.created_at)}</p>
        </div>
        {unread && (
          <Button variant="ghost" size="sm" loading={marking} onClick={onMarkRead}>
            Mark read
          </Button>
        )}
      </div>
    </Card>
  );
}
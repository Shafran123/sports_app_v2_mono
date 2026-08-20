"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { auth as authApi, toApiFailure } from "@spots/api";
import { Avatar, Badge, Button, Card, Input, Toast } from "@spots/ui";
import type { User } from "@spots/types";
import { useAuth } from "@/context/auth";

interface Feedback {
  tone: "success" | "error";
  title: string;
  message?: string;
}

export function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user) return null;

  return <ProfileForm key={user.id} user={user} onLogout={logout} />;
}

function ProfileForm({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const router = useRouter();
  const [me, setMe] = useState<User>(user);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();

    setSaving(true);
    try {
      const updated = await authApi.updateMe(undefined, {
        name: name || undefined,
        phone: phone || undefined,
        city: city || undefined
      });
      setMe(updated);
      router.refresh();
      setFeedback({ tone: "success", title: "Profile saved" });
    } catch (err) {
      const failure = toApiFailure(err);
      setFeedback({ tone: "error", title: "Could not save", message: failure.message });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await onLogout();
    router.replace("/login");
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-8 md:pb-14">
      {feedback && (
        <div className="mb-4">
          <Toast
            tone={feedback.tone}
            title={feedback.title}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}

      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <Avatar name={me.name} size="lg" />
          <h1 className="mt-3 font-display text-xl font-extrabold tracking-tight text-ink">
            {me.name || "Player"}
          </h1>
          <p className="mt-0.5 text-sm text-ink-2">{me.email}</p>
          <Badge
            variant={me.role === "admin" ? "success" : me.role === "venue_owner" ? "accent" : "primary"}
            className="mt-2 capitalize"
          >
            {me.role.replace("_", " ")}
          </Badge>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
              Name
            </label>
            <Input id="name" name="name" defaultValue={me.name ?? ""} placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink">
              Phone
            </label>
            <Input
              id="phone"
              name="phone"
              defaultValue={me.phone ?? ""}
              placeholder="+94 7X XXX XXXX"
              inputMode="tel"
            />
          </div>
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-ink">
              City
            </label>
            <Input id="city" name="city" defaultValue={me.city ?? ""} placeholder="Your city" />
          </div>
          <Button type="submit" loading={saving} className="w-full">
            Save changes
          </Button>
        </form>

        <div className="mt-4 border-t border-border pt-4">
          <Button
            variant="ghost"
            loading={loggingOut}
            onClick={handleLogout}
            className="w-full text-error hover:bg-error-light hover:text-error"
          >
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </Card>
    </main>
  );
}
"use client";

import { useCallback, useRef, useState } from "react";
import { Toast, ToastViewport, type ToastTone } from "@myslot/ui";

export type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
};

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((tone: ToastTone, title: string, message?: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, tone, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const viewport = (
    <ToastViewport>
      {toasts.map((t) => (
        <Toast key={t.id} tone={t.tone} title={t.title} message={t.message} onDismiss={() => dismiss(t.id)} />
      ))}
    </ToastViewport>
  );

  return { push, viewport };
}
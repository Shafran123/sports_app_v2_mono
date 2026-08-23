import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@myslot/utils";

export function Avatar({ src, name, className, size = "md" }: { src?: string | null; name?: string | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary-light font-semibold text-primary", dims, className)}
    >
      {src ? <img src={src} alt={name ?? ""} className="h-full w-full rounded-full object-cover" /> : initials || <User className="h-1/2 w-1/2" />}
    </div>
  );
}
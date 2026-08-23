export type FrameKind = "phone" | "browser";

export interface Screenshot {
  id: string;
  label: string;
  frame: FrameKind;
  /** Set `src` to a real product screenshot to swap out the CSS mockup. */
  src?: string;
}

/**
 * One screenshot slot per feature section. Every entry renders a CSS-composed
 * mockup inside a device frame until a real screenshot is added.
 *
 * Swap recipe — replace the mockup with a real image in one line:
 *   1. Export a screenshot (e.g. from the player/business app) into `public/shots/`
 *   2. Add `src: "/shots/payments.png"` to the entry below
 *   3. `DeviceFrame` renders the image instead of the mockup — nothing else changes.
 */
export const screenshots: Screenshot[] = [
  { id: "hero-player", label: "Player app — find your game", frame: "phone", src: "/shots/hero-player.png" },
  { id: "real-time-bookings", label: "Courts bookable in real time", frame: "browser" },
  { id: "front-desk", label: "Front-desk & walk-in check-ins", frame: "phone", src: "/shots/front-desk.png" },
  { id: "payments", label: "Payments your way", frame: "phone", src: "/shots/payments.png" },
  { id: "events", label: "Events & registrations", frame: "phone", src: "/shots/events.png" },
  { id: "owner-dashboard", label: "Know what's happening", frame: "browser" },
  { id: "player-venue-detail", label: "Pick a court, pick a slot", frame: "phone", src: "/shots/player-venue-detail.png" },
  { id: "player-confirmation", label: "Your booking, QR-ready", frame: "phone", src: "/shots/player-confirmation.png" }
];

export function getScreenshot(id: string): Screenshot | undefined {
  return screenshots.find((shot) => shot.id === id);
}

/**
 * Resolve a screenshot to an image source. Placeholders (no `src`) return
 * null, which the caller renders as the CSS mockup.
 */
export function resolveScreenshot(shot: Screenshot | undefined): string | null {
  return shot?.src ?? null;
}
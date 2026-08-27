export type FrameKind = "phone" | "tablet" | "browser";

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
 *   1. Export a screenshot (e.g. from the admin console, tablet layout) into `public/shots/`
 *   2. Add `src: "/shots/<name>.png"` to the entry below
 *   3. `DeviceFrame` renders the image instead of the mockup — nothing else changes.
 */
export const screenshots: Screenshot[] = [
  { id: "dedicated-site", label: "Your venue's own website", frame: "phone", src: "/shots/dedicated-site.png" },
  { id: "real-time-bookings", label: "Bookings — live slot grid", frame: "tablet", src: "/shots/real-time-bookings.png" },
  { id: "front-desk", label: "Front-desk & walk-in check-ins", frame: "tablet", src: "/shots/front-desk.png" },
  { id: "owner-dashboard", label: "Dashboard — your venue's day", frame: "tablet", src: "/shots/owner-dashboard.png" }
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
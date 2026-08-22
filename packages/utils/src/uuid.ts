/**
 * Generate a UUID v4 string that works everywhere.
 *
 * `crypto.randomUUID` is a secure-context-only API: on plain-HTTP origins
 * (a LAN dev server, or a WebView pointing at http://<ip>:3001) it is
 * undefined and calling it crashes the page. Prefer it when present, then
 * fall back to `crypto.getRandomValues` (available on insecure origins too),
 * and finally to Math.random as a no-crypto last resort.
 */
export function uuidV4(): string {
  const bytes = new Uint8Array(16);
  const c = typeof crypto !== "undefined" ? crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const b6 = bytes[6] ?? 0;
  const b8 = bytes[8] ?? 0;
  bytes[6] = (b6 & 0x0f) | 0x40;
  bytes[8] = (b8 & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
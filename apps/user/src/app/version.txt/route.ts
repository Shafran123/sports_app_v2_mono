// Staff build-version endpoint (ADR-0036). Plain-text `vX.Y.Z` so staff can
// confirm which release is serving any hostname — including a Dedicated Site,
// whose white-labeled UI intentionally never shows a version (ADR-0029). Sits
// outside the (shell) layout so it responds identically on marketplace and
// site hosts. A `_`-prefixed dir would be treated as private by Next, so it's
// `/version.txt` (like robots.txt), a conventional text probe.
export function GET() {
  return new Response(`v${process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown"}\n`, {
    headers: { "Content-Type": "text/plain" }
  });
}
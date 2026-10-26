import { readFileSync } from "node:fs";

// Single shared release version (ADR-0036): the source of truth is the root
// package.json `version`. Injected here at build time so every surface stamps
// the same number with no per-app ceremony.
const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

// Routes that must never be indexed: the retired marketplace (ADR-0045) and
// account/checkout utility pages. Done with a header (not robots.txt Disallow)
// so crawlers can still fetch the page and see the noindex.
const NOINDEX_SOURCES = [
  "/explore",
  "/events/:path*",
  "/venues/:path*",
  "/bookings/:path*",
  "/book/:path*",
  "/profile",
  "/notifications",
  "/become-owner",
  "/style-guide",
  "/login",
  "/register",
  "/dashboard"
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPackage.version
  },
  transpilePackages: ["@myslot/ui", "@myslot/utils", "@myslot/types", "@myslot/api"],
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2400";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/v1/:path*`
      }
    ];
  },
  async headers() {
    // The widget must be embeddable on the venue's OWN site (any origin);
    // the domain allowlist is enforced server-side on the config request, not
    // by the browser's frame policy. Next.js sets no frame headers by default,
    // but an explicit CSP keeps middleware/future proxies honest.
    return [
      ...NOINDEX_SOURCES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }]
      })),
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }]
      }
    ];
  }
};

export default nextConfig;
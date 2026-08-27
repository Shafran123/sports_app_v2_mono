import { readFileSync } from "node:fs";

// Single shared release version (ADR-0036): source of truth is the root package.json.
const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

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
  }
};

export default nextConfig;
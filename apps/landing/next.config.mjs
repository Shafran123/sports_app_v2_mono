/** @type {import('next').NextConfig} */
const nextConfig = {
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
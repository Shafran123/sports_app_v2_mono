import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DEFAULT_BRAND_NAME } from "@myslot/utils";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"]
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["800"]
});

async function getBrandName(): Promise<string> {
  try {
    const backend = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2400";
    const res = await fetch(`${backend}/api/v1/public/feature-flags`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_BRAND_NAME;
    const body: { data?: { brand_name?: string } } = await res.json();
    return body?.data?.brand_name || DEFAULT_BRAND_NAME;
  } catch {
    return DEFAULT_BRAND_NAME;
  }
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: `${brand} Console`,
    description: "Manage venues, courts, bookings and events."
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${sora.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
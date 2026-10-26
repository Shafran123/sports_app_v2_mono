import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ConsentBanner } from "@/components/consent-banner";
import { DEFAULT_BRAND_NAME } from "@myslot/utils";
import { contact } from "@/lib/copy";
import { SITE_URL } from "@/lib/site";

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
  const title = `${brand} — Your venue's own booking website`;
  const description =
    "Give your sports facility a dedicated website — real-time slot booking, one-tap QR check-ins, and a clear view of your day. List your venue free for 3 months.";
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: { type: "website", siteName: brand, title, description, url: "/", locale: "en_LK" },
    twitter: { card: "summary_large_image", title, description }
  };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: DEFAULT_BRAND_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon`,
      email: contact.email,
      telephone: contact.phone,
      address: { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "LK" }
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: DEFAULT_BRAND_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` }
    },
    {
      "@type": "SoftwareApplication",
      name: DEFAULT_BRAND_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Dedicated booking website for sports venues with real-time slot booking, QR check-ins and an owner dashboard.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "LKR", description: "Free for the first 3 months" },
      publisher: { "@id": `${SITE_URL}/#organization` }
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${sora.variable} antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Providers>
          {children}
          <ConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
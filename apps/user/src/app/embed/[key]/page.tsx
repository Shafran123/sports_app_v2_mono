import type { Metadata } from "next";
import { WidgetEmbed } from "@/features/widget/widget-embed";

export const dynamic = "force-dynamic";

// The embed route is chrome-free and iframe-friendly (ADR-0028, ticket 07).
// The page itself never frames out: the parent-origin check runs on the live
// widget config request, so a key pasted on an unapproved site renders the
// denial state, not the booking flow.
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return {
    title: "Book a slot",
    robots: { index: false }
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <WidgetEmbed widgetKey={key} />;
}
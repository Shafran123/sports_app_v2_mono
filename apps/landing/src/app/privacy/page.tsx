import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How MySlot.LK collects, uses and protects the information you share when you enquire or book.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms that apply when you use MySlot.LK to list a venue or book a court.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
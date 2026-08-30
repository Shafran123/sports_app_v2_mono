import { MarketplaceClosed } from "@/features/marketplace/marketplace-closed";

// Marketplace retirement (ADR-0045): browse/search is closed to customers.
export default function Page() {
  return <MarketplaceClosed />;
}
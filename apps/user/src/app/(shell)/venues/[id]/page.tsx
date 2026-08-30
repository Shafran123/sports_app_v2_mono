import { MarketplaceClosed } from "@/features/marketplace/marketplace-closed";

// Marketplace retirement (ADR-0045): in-app venue details are closed; venues
// sell on their own site/widget surfaces.
export default async function Page() {
  return <MarketplaceClosed />;
}
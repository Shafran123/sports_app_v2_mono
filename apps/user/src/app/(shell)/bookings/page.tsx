import { MarketplaceClosed } from "@/features/marketplace/marketplace-closed";

// Marketplace retirement (ADR-0045): player "my bookings" is closed. Existing
// bookings keep working — QR check-in and cancellations run through the
// confirmation/reminder emails (owner/admin-assisted cancellation).
export default function Page() {
  return <MarketplaceClosed />;
}
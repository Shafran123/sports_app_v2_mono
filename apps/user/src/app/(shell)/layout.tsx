import { PlayerNav } from "@/components/shell/player-nav";
import { BottomTabs } from "@/components/shell/bottom-tabs";
import { Footer } from "@/components/shell/footer";
import { SiteChrome } from "@/features/site/site-chrome";
import { getSiteContext } from "@/lib/site-context";

// Host-based shell (ADR-0029): a live Dedicated Site hostname renders the
// Business's white-labeled chrome around the same app pages (venue detail,
// checkout, bookings) — the marketplace shell only wraps its own hostname.
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteContext();
  if (site) return <SiteChrome config={site}>{children}</SiteChrome>;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <PlayerNav />
      <div className="flex-1">{children}</div>
      <Footer />
      <BottomTabs />
    </div>
  );
}
import { PlayerNav } from "@/components/shell/player-nav";
import { BottomTabs } from "@/components/shell/bottom-tabs";
import { Footer } from "@/components/shell/footer";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <PlayerNav />
      <div className="flex-1">{children}</div>
      <Footer />
      <BottomTabs />
    </div>
  );
}
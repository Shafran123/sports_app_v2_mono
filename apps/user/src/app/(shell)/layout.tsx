import { PlayerNav } from "@/components/shell/player-nav";
import { BottomTabs } from "@/components/shell/bottom-tabs";
import { Footer } from "@/components/shell/footer";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <PlayerNav />
      {children}
      <Footer />
      <BottomTabs />
    </div>
  );
}
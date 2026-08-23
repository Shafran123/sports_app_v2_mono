import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlayerNav } from "./player-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Test", email: "t@spots.app", role: "player" }, loading: false, logout: vi.fn() })
}));

vi.mock("@/hooks/use-unread", () => ({
  useUnread: () => 3
}));

vi.mock("@myslot/api", () => ({
  featureFlags: {
    get: vi.fn(async () => ({
      phone_verification_required: false,
      sms_enabled: false,
      payhere_enabled: false,
      events_discovery_state: "enabled",
      brand_name: "MySlot.LK"
    }))
  }
}));

function renderNav() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerNav />
    </QueryClientProvider>
  );
}

describe("PlayerNav", () => {
  it("right-aligns a borderless bell + avatar pair", () => {
    renderNav();
    const bell = screen.getByRole("link", { name: /notifications/i });
    expect(bell).toBeInTheDocument();
    expect(bell.className).not.toContain("border");
    expect(bell.className).not.toContain("bg-");
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the wordmark from the configured brand", async () => {
    renderNav();
    await waitFor(() => expect(screen.getByText("MySlot")).toBeInTheDocument());
    expect(screen.getByText(".LK")).toBeInTheDocument();
  });

  it("pushes the icon pair to the far right with a gap from the logo", () => {
    renderNav();
    const bell = screen.getByRole("link", { name: /notifications/i });
    const iconGroup = bell.parentElement;
    expect(iconGroup).not.toBeNull();
    expect(iconGroup!.className).toContain("ml-auto");
    expect(iconGroup!.className).toContain("gap-");
    expect(iconGroup!.querySelectorAll("a").length).toBe(2);
  });

  it("hides the Events link when discovery state is hidden", async () => {
    const { featureFlags } = await import("@myslot/api");
    const get = featureFlags.get as ReturnType<typeof vi.fn>;
    get.mockResolvedValue({
      phone_verification_required: false,
      sms_enabled: false,
      payhere_enabled: false,
      events_discovery_state: "hidden",
      brand_name: "MySlot.LK"
    });
    renderNav();
    await waitFor(() => expect(screen.queryByRole("link", { name: "Events" })).toBeNull());
    expect(screen.getByRole("link", { name: "Explore" })).toBeInTheDocument();
  });
});
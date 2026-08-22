import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("PlayerNav", () => {
  it("right-aligns a borderless bell + avatar pair", () => {
    render(<PlayerNav />);
    const bell = screen.getByRole("link", { name: /notifications/i });
    expect(bell).toBeInTheDocument();
    expect(bell.className).not.toContain("border");
    expect(bell.className).not.toContain("bg-");
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("pushes the icon pair to the far right with a gap from the logo", () => {
    render(<PlayerNav />);
    const bell = screen.getByRole("link", { name: /notifications/i });
    const iconGroup = bell.parentElement;
    expect(iconGroup).not.toBeNull();
    expect(iconGroup!.className).toContain("ml-auto");
    expect(iconGroup!.className).toContain("gap-");
    expect(iconGroup!.querySelectorAll("a").length).toBe(2);
  });
});
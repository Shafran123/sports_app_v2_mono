import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomTabs } from "./bottom-tabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore"
}));

describe("BottomTabs", () => {
  it("shows a filled pill on the active tab", () => {
    render(<BottomTabs />);
    const explore = screen.getByRole("link", { name: "Explore" });
    const home = screen.getByRole("link", { name: "Home" });
    expect(explore.className).toContain("bg-primary-light");
    expect(explore.className).toContain("text-primary");
    expect(home.className).not.toContain("bg-primary-light");
  });
});
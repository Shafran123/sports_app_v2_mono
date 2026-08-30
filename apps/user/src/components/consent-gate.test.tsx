import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsentGate } from "./consent-gate";
import { usePathname } from "next/navigation";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/explore")
}));

vi.mock("@/hooks/use-brand-name", () => ({
  useBrandName: () => "MySlot.LK"
}));

const mockPathname = vi.mocked(usePathname);

describe("ConsentGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname.mockReturnValue("/explore");
  });

  it("renders the consent banner on app surfaces", () => {
    render(<ConsentGate />);
    const region = screen.getByRole("region", { name: "Analytics consent" });
    expect(region).toBeInTheDocument();
  });

  it("renders nothing inside the widget embed iframe", () => {
    mockPathname.mockReturnValue("/embed/abc123");
    render(<ConsentGate />);
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();
  });
});

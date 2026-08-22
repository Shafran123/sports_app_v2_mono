import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ShellLayout from "./layout";

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "a@spots.app", role: "admin" },
    loading: false,
    logout: vi.fn()
  }),
  RequireStaff: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("@/hooks/use-realtime", () => ({
  RealtimeBridge: () => null
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

describe("ShellLayout", () => {
  it("wraps the page in a padded main so console pages get gutters and bottom nav clearance", () => {
    render(
      <ShellLayout>
        <div>Page content</div>
      </ShellLayout>
    );
    const main = screen.getByRole("main");
    expect(main).toContainHTML("Page content");
    expect(main.className).toContain("px-5");
    expect(main.className).toContain("lg:px-8");
    expect(main.className).toContain("pb-28");
    expect(main.className).toContain("md:pb-12");
    expect(main.className).toContain("pt-5");
  });
});
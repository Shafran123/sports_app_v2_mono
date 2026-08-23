import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

describe("ShellLayout", () => {
  it("wraps the page in a padded main so console pages get gutters and bottom nav clearance", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShellLayout>
          <div>Page content</div>
        </ShellLayout>
      </QueryClientProvider>
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
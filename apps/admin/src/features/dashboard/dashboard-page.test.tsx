import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "./dashboard-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "admin@spots.lk", role: "admin" },
    loading: false,
    logout: vi.fn()
  })
}));

vi.mock("@spots/api", () => ({
  business: { overview: vi.fn() },
  admin: {
    overview: vi.fn(),
    pendingVenues: vi.fn()
  }
}));

import { admin, business } from "@spots/api";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

describe("admin dashboard", () => {
  beforeEach(() => {
    vi.mocked(business.overview).mockResolvedValue({} as never);
    vi.mocked(admin.overview).mockResolvedValue({
      revenue_today: 7500,
      bookings_today: 12,
      total_venues: 24,
      pending_approvals: 3,
      date: "2026-08-21"
    } as never);
  });

  it("renders real platform numbers instead of zero", async () => {
    renderPage();
    expect(await screen.findByText("Rs 7,500")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(admin.overview).toHaveBeenCalledTimes(1);
  });
});
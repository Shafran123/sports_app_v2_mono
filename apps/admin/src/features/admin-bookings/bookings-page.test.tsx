import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookingsPage } from "./bookings-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "a1", name: "Admin", email: "a@spots.lk", role: "admin" },
    loading: false,
    logout: vi.fn()
  })
}));

vi.mock("@myslot/api", () => ({
  business: { listBookings: vi.fn() },
  venues: { mine: vi.fn() },
  sports: { list: vi.fn() }
}));

import { business } from "@myslot/api";

function makeBooking(overrides: Record<string, unknown> = {}) {
  const start = new Date();
  return {
    id: "b1",
    court_id: "c1",
    user_id: null,
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 3600_000).toISOString(),
    price_per_slot: 800,
    total_price: 800,
    status: "confirmed",
    payment_method: "online",
    player_name: "Nimal",
    court_name: "Court 1",
    venue_name: "Badminton Arena",
    ...overrides
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BookingsPage />
    </QueryClientProvider>
  );
}

describe("bookings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(business.listBookings).mockResolvedValue({
      data: [makeBooking()],
      meta: { total: 1 }
    });
  });

  it("shows a Date column with each booking's date", async () => {
    renderPage();
    expect(await screen.findByText("Date")).toBeInTheDocument();
    expect(await screen.findByText("Today")).toBeInTheDocument();
  });
});

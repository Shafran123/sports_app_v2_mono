import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookingsList } from "./bookings-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("")
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: { id: "u1", name: "T", email: "t@spots.app", role: "player" }, loading: false, logout: vi.fn() })
}));

vi.mock("@myslot/api", () => ({
  bookings: { list: vi.fn(), cancel: vi.fn() },
  toApiFailure: () => ({ status: 0, code: "UNKNOWN", message: "err" })
}));

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,xx")
}));

import { bookings } from "@myslot/api";

const confirmedBooking = {
  id: "b-123",
  court_id: "c1",
  user_id: "u1",
  venue_name: "Smash Arena",
  court_name: "Court 1",
  sport: "Badminton",
  start_at: "2026-08-30T04:30:00.000Z",
  end_at: "2026-08-30T05:30:00.000Z",
  price_per_slot: 1500,
  total_price: 1500,
  status: "confirmed",
  payment_method: "cash",
  qr_token: "tok-abc",
  created_at: "2026-08-01T00:00:00.000Z"
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BookingsList />
    </QueryClientProvider>
  );
}

describe("BookingsList booking detail", () => {
  beforeEach(() => {
    vi.mocked(bookings.list).mockResolvedValue([confirmedBooking] as never);
  });

  it("opens a detail sheet with the QR code when a booking is tapped", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /View/ }));

    expect(await screen.findByText("Booking details")).toBeInTheDocument();
    expect(screen.getAllByText("Smash Arena").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("b-123")).toBeInTheDocument();
    expect(screen.getByAltText("Booking check-in QR code")).toHaveAttribute("src", "data:image/png;base64,xx");
    expect(screen.getByRole("link", { name: /View venue/ })).toHaveAttribute("href", "/explore?search=Smash%20Arena");
  });
});
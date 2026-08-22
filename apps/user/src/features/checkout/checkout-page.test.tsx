import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutPage } from "./checkout-page";

const useSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => useSearchParams()
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Test", email: "t@spots.app", role: "player" },
    loading: false,
    logout: vi.fn()
  })
}));

vi.mock("@spots/api", () => ({
  venues: {
    detail: vi.fn(),
    list: vi.fn(),
    mine: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    resubmit: vi.fn(),
    availability: vi.fn()
  },
  bookings: {
    checkout: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    cancel: vi.fn(),
    markPaid: vi.fn()
  },
  submitPayHere: vi.fn(),
  toApiFailure: () => ({ status: 0, code: "UNKNOWN", message: "err" }),
  getClient: vi.fn(),
  setClient: vi.fn()
}));

import { venues, bookings, submitPayHere } from "@spots/api";

const onlineVenue = {
  id: "v1", name: "Smash Arena", status: "approved", description: null,
  address: "10 Marina Rd", city: "Colombo", phone: null, photos: [], amenities: [],
  rules: null, cancellation_policy: null, accepts_cash: false,
  courts: [], sports: [], hours: []
};

const cashVenue = { ...onlineVenue, accepts_cash: true };

const onlineResult = {
  hold_id: "h1", idempotency_key: "ik", amount: 1500, currency: "LKR",
  expires_at: "2026-08-22T05:00:00.000Z", payment_params: { hash: "abc" }
};

const cashResult = {
  amount: 1500,
  currency: "LKR",
  booking: {
    id: "b1", court_id: "court-1", user_id: "u1", start_at: "2026-08-22T04:30:00.000Z",
    end_at: "2026-08-22T05:30:00.000Z", price_per_slot: 1500, total_price: 1500,
    status: "confirmed", payment_method: "cash", qr_token: "tok-1"
  }
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CheckoutPage venueId="v1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(venues.detail).mockResolvedValue(onlineVenue as never);
  useSearchParams.mockReturnValue(
    new URLSearchParams({
      court_id: "court-1",
      start_at: "2026-08-22T04:30:00.000Z",
      end_at: "2026-08-22T05:30:00.000Z",
      venue: "Smash Arena",
      venue_slug: "smash",
      court: "Court 1"
    })
  );
});

describe("CheckoutPage payment method", () => {
  it("auto-checkouts online when the venue does not accept cash", async () => {
    vi.mocked(venues.detail).mockResolvedValue(onlineVenue as never);
    vi.mocked(bookings.checkout).mockResolvedValue(onlineResult as never);

    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Total/).length).toBeGreaterThan(0));

    expect(bookings.checkout).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "online" })
    );
  });

  it("shows a pay-at-venue option for cash-accepting venues", async () => {
    vi.mocked(venues.detail).mockResolvedValue(cashVenue as never);

    renderPage();
    const cashOption = await screen.findByTestId("method-cash");
    expect(cashOption).toBeInTheDocument();
    expect(bookings.checkout).not.toHaveBeenCalled();
  });

  it("checkouts with payment_method=cash and shows pay-on-arrival confirmation", async () => {
    vi.mocked(venues.detail).mockResolvedValue(cashVenue as never);
    vi.mocked(bookings.checkout).mockResolvedValue(cashResult as never);

    renderPage();
    const cashOption = await screen.findByTestId("method-cash");
    await userEvent.click(cashOption);

    await screen.findByText("Pay on arrival");
    expect(bookings.checkout).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "cash" })
    );
    expect(screen.getByText(/View booking & QR code/i)).toBeInTheDocument();
  });

  it("does not call PayHere for a cash booking", async () => {
    vi.mocked(venues.detail).mockResolvedValue(cashVenue as never);
    vi.mocked(bookings.checkout).mockResolvedValue(cashResult as never);

    renderPage();
    const cashOption = await screen.findByTestId("method-cash");
    await userEvent.click(cashOption);
    await waitFor(() => expect(screen.getByText("Pay on arrival")).toBeInTheDocument());
    expect(submitPayHere).not.toHaveBeenCalled();
  });
});

describe("CheckoutPage venue/court display", () => {
  it("falls back to the fetched venue name when the URL param is missing", async () => {
    vi.mocked(venues.detail).mockResolvedValue(cashVenue as never);
    vi.mocked(bookings.checkout).mockResolvedValue(cashResult as never);

    // Remove the venue param: only court_id/start_at/end_at arrive (old deep links).
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({
        court_id: "court-1",
        start_at: "2026-08-22T04:30:00.000Z",
        end_at: "2026-08-22T05:30:00.000Z"
      })
    );

    renderPage();
    const cashOption = await screen.findByTestId("method-cash");
    await userEvent.click(cashOption);
    await screen.findByText("Pay on arrival");
    expect(screen.getByText("Smash Arena")).toBeInTheDocument();
  });
});
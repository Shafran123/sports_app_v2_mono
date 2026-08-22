import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutPage } from "./checkout-page";

const { verifySendMock, verifyConfirmMock, setUserMock, useSearchParams } = vi.hoisted(() => ({
  verifySendMock: vi.fn(),
  verifyConfirmMock: vi.fn(),
  setUserMock: vi.fn(),
  useSearchParams: vi.fn()
}));

let ctxUser: Record<string, unknown> = {
  id: "u1",
  name: "Test",
  email: "t@spots.app",
  role: "player",
  phone: "+94771234567",
  phone_verified_at: "2026-08-22T10:00:00.000Z"
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => useSearchParams()
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: ctxUser,
    loading: false,
    logout: vi.fn(),
    setUser: setUserMock
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
  featureFlags: {
    get: vi.fn(async () => ({
      phone_verification_required: true,
      sms_enabled: true,
      payhere_enabled: true,
      events_discovery_state: "enabled",
      brand_name: "Spots"
    }))
  },
  auth: {
    updateMe: vi.fn(),
    me: vi.fn(),
    verifyPhoneSend: verifySendMock,
    verifyPhoneConfirm: verifyConfirmMock
  },
  submitPayHere: vi.fn(),
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: e?.code === "VERIFIED_PHONE_REQUIRED" ? 409 : 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  }),
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
  setUserMock.mockImplementation((u: Record<string, unknown>) => {
    ctxUser = { ...ctxUser, ...u };
  });
  verifyConfirmMock.mockImplementation(async (_p: string, _c: string) => ({
      ...ctxUser,
      phone_verified_at: "2026-08-22T10:05:00.000Z"
    }));
  ctxUser = {
    id: "u1",
    name: "Test",
    email: "t@spots.app",
    role: "player",
    phone: "+94771234567",
    phone_verified_at: "2026-08-22T10:00:00.000Z"
  };
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

describe("CheckoutPage verified-phone gate", () => {
  it("blocks checkout and shows the verify modal for an unverified user", async () => {
    ctxUser = { ...ctxUser, phone_verified_at: null };
    vi.mocked(venues.detail).mockResolvedValue(onlineVenue as never);

    renderPage();

    expect(await screen.findByText(/You need a verified phone to book/)).toBeInTheDocument();
    expect(bookings.checkout).not.toHaveBeenCalled();
  });

  it("proceeds with checkout after the user verifies, carrying their phone", async () => {
    ctxUser = { ...ctxUser, phone_verified_at: null };
    vi.mocked(venues.detail).mockResolvedValue(onlineVenue as never);
    vi.mocked(bookings.checkout).mockResolvedValue(onlineResult as never);
    verifySendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });

    renderPage();
    await screen.findByText("Verify your phone");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Phone number"), "+94771234567");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));

    await waitFor(() => expect(bookings.checkout).toHaveBeenCalled());
    expect(bookings.checkout).toHaveBeenCalledWith(
      expect.objectContaining({ player_phone: "+94771234567" })
    );
  });

  it("reopens the verify modal when the backend rejects with VERIFIED_PHONE_REQUIRED", async () => {
    ctxUser = { ...ctxUser, phone_verified_at: "2026-08-22T10:00:00.000Z" };
    vi.mocked(venues.detail).mockResolvedValue(onlineVenue as never);
    vi.mocked(bookings.checkout).mockRejectedValue({
      code: "VERIFIED_PHONE_REQUIRED",
      message: "Verify your phone number before booking."
    });

    renderPage();

    expect(await screen.findByText(/Verify your phone/)).toBeInTheDocument();
  });
});
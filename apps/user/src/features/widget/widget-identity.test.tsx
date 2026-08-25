import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BookPanel } from "./book-panel";

const { phoneSendMock, phoneConfirmMock, checkoutMock, loginCustomMock, setUserMock } = vi.hoisted(() => ({
  phoneSendMock: vi.fn(),
  phoneConfirmMock: vi.fn(),
  checkoutMock: vi.fn(),
  loginCustomMock: vi.fn(),
  setUserMock: vi.fn()
}));

let ctxUser: Record<string, unknown> | null = null;

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: ctxUser, loading: false, setUser: setUserMock, logout: vi.fn() })
}));

vi.mock("@myslot/api", () => ({
  widget: {
    config: vi.fn(),
    phoneSend: phoneSendMock,
    phoneConfirm: phoneConfirmMock
  },
  bookings: { checkout: checkoutMock },
  venues: { availability: vi.fn() },
  auth: { me: vi.fn(async () => ({ id: "u-fresh", phone: "+94771234567", phone_verified_at: "2026-08-22T10:00:00.000Z", role: "player" })) },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("@myslot/auth", () => ({
  loginWithCustomToken: loginCustomMock
}));

vi.mock("qrcode", () => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,x")
}));

const baseConfig = {
  id: "venue-1",
  name: "Widget Court Club",
  widget_key: "abc123",
  status: "approved" as const,
  description: null,
  address: "5 Ave",
  city: "Colombo",
  phone: null,
  photos: [],
  amenities: [],
  rules: null,
  cancellation_policy: null,
  accepts_cash: true,
  venue_tax_rate: 0,
  advance_days: 14,
  sports: ["Badminton"],
  courts: [],
  hours: []
};

const availability = {
  date: "2026-08-26",
  advance_days: 14,
  venue_offer: null,
  courts: [
    {
      court_id: "court-1",
      name: "Court 1",
      sport: "Badminton",
      price_per_slot: 1000,
      slot_duration_min: 60,
      slots: [
        { start_at: "2026-08-26T10:00:00+05:30", end_at: "2026-08-26T11:00:00+05:30", state: "available" },
        { start_at: "2026-08-26T11:00:00+05:30", end_at: "2026-08-26T12:00:00+05:30", state: "available" }
      ]
    }
  ]
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookPanel config={baseConfig} widgetKey="abc123" />
    </QueryClientProvider>
  );
}

function wrap(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("BookPanel", () => {
  beforeEach(() => {
    ctxUser = null;
    vi.clearAllMocks();
  });

  it("shows the unified phone identity step for a fresh visitor", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: /verify to book/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("077 123 4567")).toBeInTheDocument();
  });

  it("verifies the phone, signs the visitor in, and unlocks booking", async () => {
    phoneSendMock.mockResolvedValue({ sent: true });
    phoneConfirmMock.mockResolvedValue({ token: "custom-token", is_new: true });
    renderPanel();

    await userEvent.type(screen.getByPlaceholderText("077 123 4567"), "0771234567");
    await userEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("6-digit code")).toBeInTheDocument();
    });

    // A fresh visitor has no session yet — the panel only moves on once the
    // auth user is set (by the identity step), so set it here.
    await userEvent.type(screen.getByPlaceholderText("6-digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verify & book/i }));

    await waitFor(() => {
      expect(phoneConfirmMock).toHaveBeenCalledWith("abc123", "+94771234567", "123456");
      expect(loginCustomMock).toHaveBeenCalledWith("custom-token");
    });
  });

  it("shows the booking flow directly for an already-verified player and books cash", async () => {
    ctxUser = { id: "u1", name: "T", phone: "+94771234567", phone_verified_at: "2026-08-22T10:00:00.000Z", role: "player" };
    const { venues } = await import("@myslot/api");
    (venues.availability as typeof vi.fn).mockResolvedValue(availability);
    checkoutMock.mockResolvedValue({
      booking: { id: "bk-123", qr_token: "a".repeat(32), status: "confirmed", payment_method: "cash", start_at: "2026-08-26T10:00:00+05:30" }
    });

    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/book a slot/i)).toBeInTheDocument();
    });

    // duration + slot pick
    await userEvent.selectOptions(screen.getByLabelText(/duration/i), "60");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /10:00 pm|10:00/i })).toBeDefined();
    });
    // select the first available slot chip via its aria-pressed state
    const chips = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === null);
    // fall back: click the slot button labelled with the start time
    const slotButton = screen.getByRole("button", {
      name: /2026|10:00/i
    });
    await userEvent.click(slotButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm booking — pay at venue/i })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: /confirm booking — pay at venue/i }));

    await waitFor(() => {
      expect(checkoutMock).toHaveBeenCalledWith({
        court_id: "court-1",
        start_at: "2026-08-26T10:00:00+05:30",
        end_at: "2026-08-26T11:00:00+05:30",
        idempotency_key: expect.any(String),
        payment_method: "cash",
        player_phone: "+94771234567"
      });
      expect(screen.getByText(/you're booked/i)).toBeInTheDocument();
    });
  });
});

// The WidgetIdentity flow (ticket 03) drives the embed's first step.
import { WidgetIdentity } from "./widget-identity";

describe("WidgetIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the OTP and reveals the code step, then signs in with the returned token", async () => {
    phoneSendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    const onDone = vi.fn();
    wrap(<WidgetIdentity widgetKey="k1" onDone={onDone} />);

    await userEvent.type(screen.getByPlaceholderText("077 123 4567"), "+94771234000");
    await userEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => {
      expect(phoneSendMock).toHaveBeenCalledWith("k1", "+94771234000");
      expect(screen.getByPlaceholderText("6-digit code")).toBeInTheDocument();
    });

    phoneConfirmMock.mockResolvedValue({ token: "tk-1", is_new: false });
    await userEvent.type(screen.getByPlaceholderText("6-digit code"), "112233");
    await userEvent.click(screen.getByRole("button", { name: /verify & book/i }));

    await waitFor(() => {
      expect(phoneConfirmMock).toHaveBeenCalledWith("k1", "+94771234000", "112233");
      expect(loginCustomMock).toHaveBeenCalledWith("tk-1");
      expect(onDone).toHaveBeenCalled();
    });
  });
});
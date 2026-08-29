import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WidgetBookings } from "./widget-bookings";

const { listMock, getMock, cancelMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  getMock: vi.fn(),
  cancelMock: vi.fn()
}));

let ctxUser: Record<string, unknown> | null = null;

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: ctxUser, loading: false, setUser: vi.fn(), logout: vi.fn() })
}));

vi.mock("@myslot/api", () => ({
  bookings: { list: listMock, get: getMock, cancel: cancelMock },
  widget: { phoneSend: vi.fn(), phoneConfirm: vi.fn() },
  SITE_GOOGLE_PENDING_KEY: "site_google_pending",
  SITE_TOTP_PENDING_KEY: "site_totp_pending",
  SITE_AUTH_ERROR_KEY: "site_auth_error",
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("qrcode", () => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,x")
}));

const VENUE = { id: "v1", name: "Smash Arena", cancel_cutoff_hours: 2 };

function booking(id: string, hoursFromNow: number, venueId = "v1", courtName = "Court 1") {
  const start = new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
  const end = new Date(Date.now() + hoursFromNow * 3600 * 1000 + 3600 * 1000).toISOString();
  return {
    id,
    court_id: `c-${id}`,
    user_id: "u1",
    venue_id: venueId,
    start_at: start,
    end_at: end,
    price_per_slot: 1500,
    total_price: 1500,
    status: "confirmed",
    court_name: courtName
  };
}

function wrap(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const verified = {
  id: "u1",
  name: "Asif",
  email: "asif@example.com",
  phone: "+94771234567",
  phone_verified_at: "2026-08-22T10:00:00.000Z",
  email_verified_at: "2026-08-22T10:05:00.000Z",
  role: "player"
};

describe("WidgetBookings", () => {
  beforeEach(() => {
    ctxUser = null;
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
  });

  it("runs the identity step first when the session is not phone+email verified", () => {
    ctxUser = { ...verified, email_verified_at: null };
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /complete your booking details/i })).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("shows the empty state for a verified player with no upcoming bookings", async () => {
    ctxUser = verified;
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);
    expect(await screen.findByText(/no upcoming bookings at this venue yet/i)).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith("upcoming", { venue_id: "v1" });
  });

  it("lists only this venue's bookings and surfaces the cancel cutoff", async () => {
    ctxUser = verified;
    listMock.mockResolvedValue([
      booking("bk-close", 1),
      booking("bk-far", 5)
    ]);
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Court 1").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByRole("button", { name: /cancel/i }).length).toBe(2);

    // A booking 1h away is inside the 2h cutoff: its Cancel is disabled.
    expect(screen.getByText(/past the cancel cutoff — contact the venue\./i)).toBeInTheDocument();
  });

  it("requests the venue-scoped list from the server (no client-side filter)", async () => {
    ctxUser = verified;
    // A server-scoped response — the widget must render exactly what the
    // server returned without a fragile client filter on venue_id.
    listMock.mockResolvedValue([booking("bk-far", 5)]);
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith("upcoming", { venue_id: "v1" });
      expect(screen.getByText("Court 1")).toBeInTheDocument();
    });
  });

  it("cancels an eligible booking after confirmation", async () => {
    ctxUser = verified;
    cancelMock.mockResolvedValue({ ...booking("bk-far", 5), status: "cancelled" });
    listMock.mockResolvedValue([booking("bk-far", 5)]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith("bk-far");
    });
  });

  it("does not cancel when the player backs out of the confirm dialog", async () => {
    ctxUser = verified;
    listMock.mockResolvedValue([booking("bk-far", 5)]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(cancelMock).not.toHaveBeenCalled();
    });
  });

  it("re-views the QR from the booking detail endpoint", async () => {
    ctxUser = verified;
    listMock.mockResolvedValue([booking("bk-far", 5)]);
    getMock.mockResolvedValue({ ...booking("bk-far", 5), qr_token: "secret-token" });
    wrap(<WidgetBookings widgetKey="k1" venue={VENUE} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /show qr/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /show qr/i }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("bk-far");
      expect(screen.getByAltText("Check-in QR code")).toHaveAttribute("src", "data:image/png;base64,x");
    });
  });
});
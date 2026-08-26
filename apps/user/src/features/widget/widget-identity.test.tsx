import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BookPanel } from "./book-panel";

const { checkoutMock, meMock, updateMeMock, verifyPhoneSendMock, verifyPhoneConfirmMock, verifyEmailSendMock, verifyEmailConfirmMock } = vi.hoisted(() => ({
  checkoutMock: vi.fn(),
  meMock: vi.fn(),
  updateMeMock: vi.fn(),
  verifyPhoneSendMock: vi.fn(),
  verifyPhoneConfirmMock: vi.fn(),
  verifyEmailSendMock: vi.fn(),
  verifyEmailConfirmMock: vi.fn()
}));

let ctxUser: Record<string, unknown> | null = null;
let ctxLoading = false;

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: ctxUser, loading: ctxLoading, setUser: setUserMock, logout: vi.fn() })
}));

const { setUserMock } = vi.hoisted(() => ({ setUserMock: vi.fn() }));

vi.mock("@myslot/api", () => ({
  widget: { config: vi.fn() },
  bookings: { checkout: checkoutMock, list: vi.fn(async () => []), get: vi.fn(), cancel: vi.fn() },
  venues: { availability: vi.fn() },
  auth: {
    me: meMock,
    updateMe: updateMeMock,
    verifyPhoneSend: verifyPhoneSendMock,
    verifyPhoneConfirm: verifyPhoneConfirmMock,
    verifyEmailSend: verifyEmailSendMock,
    verifyEmailConfirm: verifyEmailConfirmMock
  },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("@myslot/auth", () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  loginWithGoogleRedirect: vi.fn(),
  sendPasswordReset: vi.fn(),
  logoutFirebase: vi.fn(),
  finishGoogleRedirect: vi.fn(async () => false)
}));

vi.mock("qrcode", () => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,x")
}));

const baseConfig = {
  id: "venue-1",
  name: "Widget Court Club",
  slug: "widget-court-club",
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
  cancel_cutoff_hours: 2,
  sports: ["Badminton"],
  courts: [],
  hours: [],
  business: {
    id: "biz-1",
    name: "Widget Court Club",
    brand: { tagline: "Book direct" }
  }
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

const verifiedUser = {
  id: "u1",
  name: "T",
  email: "t@example.com",
  phone: "+94771234567",
  phone_verified_at: "2026-08-22T10:00:00.000Z",
  email_verified_at: "2026-08-22T10:00:00.000Z",
  role: "player"
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookPanel venue={baseConfig} instanceKey="abc123" />
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
    ctxLoading = false;
    vi.clearAllMocks();
    meMock.mockResolvedValue({
      id: "u-fresh",
      name: null,
      email: null,
      phone: null,
      role: "player"
    });
  });

  it("shows a skeleton while auth is loading instead of flashing the login form", () => {
    ctxLoading = true;
    renderPanel();
    // The misleading "Sign in to book" login UI must NOT appear during auth
    // resolution — a placeholder skeleton is shown until the session settles.
    expect(screen.queryByRole("heading", { name: /sign in to book/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("identity-skeleton")).toBeInTheDocument();
  });

  it("keeps the skeleton during loading even when the session is already verified", () => {
    ctxLoading = true;
    ctxUser = verifiedUser;
    renderPanel();
    expect(screen.queryByRole("heading", { name: /book a slot/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /complete your booking details/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("identity-skeleton")).toBeInTheDocument();
  });

  it("shows the sign-in step for an anonymous visitor", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: /sign in to book/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("a fully-verified player skips straight to the picker", async () => {
    ctxUser = verifiedUser;
    const { venues } = await import("@myslot/api");
    (venues.availability as typeof vi.fn).mockResolvedValue(availability);
    checkoutMock.mockResolvedValue({
      booking: { id: "bk-123", qr_token: "a".repeat(32), status: "confirmed", payment_method: "cash", start_at: "2026-08-26T10:00:00+05:30" }
    });

    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/book a slot/i)).toBeInTheDocument();
    });

    await userEvent.selectOptions(screen.getByLabelText(/duration/i), "60");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /2026|10:00/i })).toBeDefined();
    });
    await userEvent.click(screen.getByRole("button", { name: /2026|10:00/i }));

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
        player_phone: "+94771234567",
        widget_instance_key: "abc123"
      });
      expect(screen.getByText(/you're booked/i)).toBeInTheDocument();
    });
  });
});

// The WidgetIdentity flow (ticket 08) drives the embed's first step.
import { WidgetIdentity } from "./widget-identity";

describe("WidgetIdentity", () => {
  beforeEach(() => {
    ctxUser = null;
    vi.clearAllMocks();
    meMock.mockResolvedValue({
      id: "u-1",
      name: "Asif",
      email: "asif@example.com",
      phone: "+94771234000",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:05:00.000Z",
      role: "player"
    });
    verifyPhoneSendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    verifyPhoneConfirmMock.mockResolvedValue({
      id: "u-1",
      name: "Asif",
      email: "asif@example.com",
      phone: "+94771234000",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:05:00.000Z",
      role: "player"
    });
    verifyEmailSendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    verifyEmailConfirmMock.mockResolvedValue({
      id: "u-1",
      name: "Asif",
      email: "asif@example.com",
      phone: "+94771234000",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:05:00.000Z",
      role: "player"
    });
  });

  it("shows the sign-in form (email + Google) with a register link", () => {
    wrap(<WidgetIdentity widgetKey="k1" onDone={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /sign in to book/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create an account/i })).toBeInTheDocument();
  });

  it("opens the details step when a returning player lacks a verified email", async () => {
    ctxUser = {
      id: "u-1",
      name: "Asif",
      email: "asif@example.com",
      phone: "+94771234000",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      role: "player"
    };
    wrap(<WidgetIdentity widgetKey="k1" onDone={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /complete your booking details/i })).toBeInTheDocument();
    expect(screen.getByText(/verified phone/i)).toBeInTheDocument();
    expect(screen.getByText(/verified email/i)).toBeInTheDocument();
  });

  it("brands the sign-in copy to the Business on a live site (ADR-0030)", () => {
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /sign in to book/i })).toBeInTheDocument();
    expect(screen.getByText(/use your court group account to book/i)).toBeInTheDocument();
    expect(screen.queryByText(/myslot/i)).toBeNull();
    // The register side brands too.
    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));
    expect(screen.getByText(/create an account at court group to book/i)).toBeInTheDocument();
    expect(screen.queryByText(/myslot/i)).toBeNull();
  });
});
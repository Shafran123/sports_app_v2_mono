import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BookPanel } from "./book-panel";

const { checkoutMock, meMock, updateMeMock, verifyPhoneSendMock, verifyPhoneConfirmMock, verifyEmailSendMock, verifyEmailConfirmMock, siteGoogleMock, persistSiteTokenMock, loginMock, registerMock, confirmChallengeMock, getRecaptchaTokenMock } = vi.hoisted(() => ({
  checkoutMock: vi.fn(),
  meMock: vi.fn(),
  updateMeMock: vi.fn(),
  verifyPhoneSendMock: vi.fn(),
  verifyPhoneConfirmMock: vi.fn(),
  verifyEmailSendMock: vi.fn(),
  verifyEmailConfirmMock: vi.fn(),
  siteGoogleMock: vi.fn(),
  persistSiteTokenMock: vi.fn(),
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  confirmChallengeMock: vi.fn(),
  getRecaptchaTokenMock: vi.fn()
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
  siteCustomerAuth: {
    google: siteGoogleMock,
    login: loginMock,
    register: registerMock,
    confirmChallenge: confirmChallengeMock
  },
  persistSiteToken: persistSiteTokenMock,
  SITE_GOOGLE_PENDING_KEY: "site_google_pending",
  SITE_TOTP_PENDING_KEY: "site_totp_pending",
  SITE_AUTH_ERROR_KEY: "site_auth_error",
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("@myslot/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@myslot/utils")>();
  return { ...actual, getRecaptchaToken: getRecaptchaTokenMock };
});

vi.mock("@myslot/auth", () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  loginWithGoogleRedirect: vi.fn(),
  loginWithGooglePopup: vi.fn(),
  sendPasswordReset: vi.fn(),
  logoutFirebase: vi.fn(),
  finishGoogleRedirect: vi.fn(async () => null)
}));

vi.mock("qrcode", () => ({
  __esModule: true,
  toDataURL: vi.fn(async () => "data:image/png;base64,x"),
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,x") }
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
  // ADR-0044: the widget's methods come from the Business config.
  payment_methods: { cash_enabled: true, payhere_enabled: false, payhere_configured: false },
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

  it("shows the picker immediately while auth is loading — never the sign-in UI", () => {
    ctxLoading = true;
    renderPanel();
    expect(screen.getByRole("heading", { name: /book a slot/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sign in to book/i })).not.toBeInTheDocument();
  });

  it("a verified session changes nothing about the picker while loading", () => {
    ctxLoading = true;
    ctxUser = verifiedUser;
    renderPanel();
    expect(screen.getByRole("heading", { name: /book a slot/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /complete your booking details/i })).not.toBeInTheDocument();
  });

  it("lets a guest pick slots freely, then signs in at the confirm step (ADR-0033)", async () => {
    const { venues } = await import("@myslot/api");
    (venues.availability as typeof vi.fn).mockResolvedValue(availability);
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
      expect(screen.getByRole("button", { name: /sign in \/ sign up to book/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /sign in \/ sign up to book/i }));
    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: /sign in to book/i }).length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    });
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
    // Faithful auth context: setUser actually updates the signed-in user, so
    // components that react to the session (prefilling details, etc.) behave
    // like production.
    setUserMock.mockImplementation((u: Record<string, unknown> | null) => {
      ctxUser = u as typeof ctxUser;
    });
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

  it("prefills the details step with the signed-in customer's name when the session starts null (regression: name asked again after login)", async () => {
    // Site-mode sign-in: the component mounts signed OUT (user null), then
    // the login response carries the stored customer — with a name already in
    // the DB but an email still unverified. The details step must prefill the
    // name, not ask for it again.
    loginMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "pam@site.test",
        name: "Pam Silva",
        phone: "+94771234000",
        email_verified_at: null,
        phone_verified_at: "2026-08-22T10:05:00.000Z"
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /complete your booking details/i })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Your name")).toHaveValue("Pam Silva");
  });

  it("skips the details step entirely when the signed-in customer is fully set up (name + verified phone + verified email)", async () => {
    // The reported bug: after login with nothing missing, the step still
    // showed. A complete customer must continue straight to the booking.
    const onDone = vi.fn();
    loginMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "pam@site.test",
        name: "Shafran Naizer",
        phone: "+94771234000",
        email_verified_at: "2026-08-22T10:00:00.000Z",
        phone_verified_at: "2026-08-22T10:05:00.000Z"
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={onDone} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
  });

  it("skips the details step for a restored complete session on mount", async () => {
    // A returning Site Customer (session already in storage) mounts signed in
    // with every field present — the step must never appear.
    ctxUser = {
      id: "sc-1",
      role: "player",
      name: "Shafran Naizer",
      email: "pam@site.test",
      phone: "+94771234000",
      city: null,
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:05:00.000Z",
      onboarding_state: "grandfathered"
    };
    const onDone = vi.fn();
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={onDone} />);

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
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

  it("resolves a site-mode Google sign-in (popup) as this Business's Site Customer, never a Player (ADR-0030)", async () => {
    const { loginWithGooglePopup } = await import("@myslot/auth");
    vi.mocked(loginWithGooglePopup).mockResolvedValue({ idToken: "id-token-1" });
    siteGoogleMock.mockResolvedValue({
      token: "sc-token",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "g@pam.test",
        name: "G Pam",
        phone: null,
        email_verified_at: "2026-08-22T10:00:00.000Z",
        phone_verified_at: null
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(loginWithGooglePopup).toHaveBeenCalledTimes(1);
      expect(siteGoogleMock).toHaveBeenCalledWith({ site_hostname: "courtgroup.lk", id_token: "id-token-1" });
      expect(persistSiteTokenMock).toHaveBeenCalledWith("sc-token");
      expect(setUserMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sc-1", role: "player", email: "g@pam.test" })
      );
    });
  });

  it("site-mode widget embed stashes the hostname and uses the redirect flow (popups blocked in iframes)", async () => {
    const { loginWithGoogleRedirect } = await import("@myslot/auth");
    wrap(<WidgetIdentity widgetKey="k1" siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => {
      expect(loginWithGoogleRedirect).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.getItem("site_google_pending")).toBe("courtgroup.lk");
      expect(siteGoogleMock).not.toHaveBeenCalled();
    });
  });

  it("first-party site login carries an anti-bot token and signs in on a good score (ticket 05)", async () => {
    getRecaptchaTokenMock.mockResolvedValue("tok-1");
    loginMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "pam@site.test",
        name: "Pam",
        phone: null,
        email_verified_at: null,
        phone_verified_at: null
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(getRecaptchaTokenMock).toHaveBeenCalledWith("site_login");
      expect(loginMock).toHaveBeenCalledWith({
        site_hostname: "courtgroup.lk",
        email: "pam@site.test",
        password: "password-1",
        captcha_token: "tok-1"
      });
      expect(persistSiteTokenMock).toHaveBeenCalledWith("sc-token");
      expect(setUserMock).toHaveBeenCalledWith(expect.objectContaining({ id: "sc-1", email: "pam@site.test" }));
    });
  });

  it("never mints an anti-bot token inside the widget iframe (ADR-0042)", async () => {
    getRecaptchaTokenMock.mockResolvedValue("tok-1");
    loginMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "pam@site.test",
        name: "Pam",
        phone: null,
        email_verified_at: null,
        phone_verified_at: null
      }
    });
    wrap(<WidgetIdentity widgetKey="k1" siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(getRecaptchaTokenMock).not.toHaveBeenCalled();
      expect(loginMock).toHaveBeenCalledWith({
        site_hostname: "courtgroup.lk",
        email: "pam@site.test",
        password: "password-1",
        captcha_token: undefined
      });
    });
  });

  it("escalates a low-score site login to an email-OTP challenge and finishes it (ticket 05)", async () => {
    getRecaptchaTokenMock.mockResolvedValue("tok-1");
    loginMock.mockResolvedValue({
      escalated: true,
      challenge_id: "ch-1",
      email: "pam@site.test",
      expires_at: "2026-08-22T10:10:00.000Z"
    });
    confirmChallengeMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "pam@site.test",
        name: "Pam",
        phone: null,
        email_verified_at: null,
        phone_verified_at: null
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/we emailed a 6-digit code/i)).toBeInTheDocument();
      expect(loginMock).toHaveBeenCalledWith(expect.objectContaining({ captcha_token: "tok-1" }));
      expect(persistSiteTokenMock).not.toHaveBeenCalled();
    });

    await userEvent.type(screen.getByPlaceholderText("6-digit code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(confirmChallengeMock).toHaveBeenCalledWith("ch-1", "123456");
      expect(persistSiteTokenMock).toHaveBeenCalledWith("sc-token");
      expect(setUserMock).toHaveBeenCalledWith(expect.objectContaining({ id: "sc-1" }));
    });
  });

  it("escalates a low-score site registration the same way (ticket 05)", async () => {
    getRecaptchaTokenMock.mockResolvedValue("tok-1");
    registerMock.mockResolvedValue({
      escalated: true,
      challenge_id: "ch-2",
      email: "reg@site.test",
      expires_at: "2026-08-22T10:10:00.000Z"
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /create an account/i }));
    await userEvent.type(screen.getByPlaceholderText("Your name"), "Reg Pam");
    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "reg@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password (6+ characters)"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ captcha_token: "tok-1" }));
      expect(screen.getByText(/creating your account/i)).toBeInTheDocument();
      expect(getRecaptchaTokenMock).toHaveBeenCalledWith("site_register");
    });
  });

  it("lets the visitor abandon an escalation back to the sign-in form", async () => {
    getRecaptchaTokenMock.mockResolvedValue("tok-1");
    loginMock.mockResolvedValue({
      escalated: true,
      challenge_id: "ch-3",
      email: "pam@site.test",
      expires_at: "2026-08-22T10:10:00.000Z"
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("6-digit code")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /use a different method/i }));
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("challenges an enrolled customer with the Second Factor at site login, then issues the session (ticket 08)", async () => {
    getRecaptchaTokenMock.mockResolvedValue("tok-1");
    loginMock.mockResolvedValue({
      escalated: true,
      kind: "totp",
      challenge_id: "ch-totp",
      email: "pam@site.test",
      expires_at: "2026-08-22T10:10:00.000Z"
    });
    confirmChallengeMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "pam@site.test",
        name: "Pam",
        phone: null,
        email_verified_at: null,
        phone_verified_at: null,
        totp_enabled: true
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/from your authenticator app/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("6-digit code or XXXX-XXXX")).toBeInTheDocument();
      expect(persistSiteTokenMock).not.toHaveBeenCalled();
    });

    await userEvent.type(screen.getByPlaceholderText("6-digit code or XXXX-XXXX"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(confirmChallengeMock).toHaveBeenCalledWith("ch-totp", "123456");
      expect(persistSiteTokenMock).toHaveBeenCalledWith("sc-token");
      expect(setUserMock).toHaveBeenCalledWith(expect.objectContaining({ id: "sc-1", totp_enabled: true }));
    });
  });

  it("an enrolled customer's Google popup lands on the Second Factor step, never a session (ticket 08)", async () => {
    const { loginWithGooglePopup } = await import("@myslot/auth");
    vi.mocked(loginWithGooglePopup).mockResolvedValue({ idToken: "id-token-1" });
    siteGoogleMock.mockResolvedValue({
      escalated: true,
      kind: "totp",
      challenge_id: "ch-gtotp",
      email: "g@pam.test",
      expires_at: "2026-08-22T10:10:00.000Z"
    });
    confirmChallengeMock.mockResolvedValue({
      token: "sc-token",
      expires_at: "2026-09-22T10:00:00.000Z",
      customer: {
        id: "sc-1",
        business_id: "biz-1",
        email: "g@pam.test",
        name: "G Pam",
        phone: null,
        email_verified_at: "2026-08-22T10:00:00.000Z",
        phone_verified_at: null
      }
    });
    wrap(<WidgetIdentity siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(siteGoogleMock).toHaveBeenCalledWith({ site_hostname: "courtgroup.lk", id_token: "id-token-1" });
      expect(screen.getByText(/from your authenticator app/i)).toBeInTheDocument();
      expect(persistSiteTokenMock).not.toHaveBeenCalled();
    });

    await userEvent.type(screen.getByPlaceholderText("6-digit code or XXXX-XXXX"), "654321");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));
    await waitFor(() => {
      expect(confirmChallengeMock).toHaveBeenCalledWith("ch-gtotp", "654321");
      expect(persistSiteTokenMock).toHaveBeenCalledWith("sc-token");
    });
  });

  it("a venue that requires 2FA explains itself to the widget visitor (ticket 09)", async () => {
    loginMock.mockRejectedValue({
      code: "SECOND_FACTOR_REQUIRED",
      message: "This venue requires two-factor authentication. Enable it in your profile to sign in."
    });
    wrap(<WidgetIdentity widgetKey="k1" siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText("you@example.com"), "pam@site.test");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password-1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/enable it in your account on the venue's site/i);
    });
  });

  it("shows a parked require-2FA error after the widget's Google redirect settle (ticket 09)", async () => {
    window.sessionStorage.setItem(
      "site_auth_error",
      JSON.stringify({ message: "This venue requires two-factor authentication. Enable it in your profile to sign in." })
    );
    wrap(<WidgetIdentity widgetKey="k1" siteHostname="courtgroup.lk" siteName="Court Group" onDone={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/enable it in your profile to sign in/i);
    });
    expect(window.sessionStorage.getItem("site_auth_error")).toBeNull();
  });
});
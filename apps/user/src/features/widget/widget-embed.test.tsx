import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WidgetEmbed } from "./widget-embed";

const { configMock, featureFlagsMock, bookingsListMock, bookingsGetMock, bookingsCancelMock, siteGoogleMock, persistSiteTokenMock, setUserMock } = vi.hoisted(() => ({
  configMock: vi.fn(),
  featureFlagsMock: vi.fn(),
  bookingsListMock: vi.fn(),
  bookingsGetMock: vi.fn(),
  bookingsCancelMock: vi.fn(),
  siteGoogleMock: vi.fn(),
  persistSiteTokenMock: vi.fn(),
  setUserMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  widget: { config: configMock },
  featureFlags: { get: featureFlagsMock },
  bookings: { list: bookingsListMock, get: bookingsGetMock, cancel: bookingsCancelMock },
  siteCustomerAuth: { google: siteGoogleMock },
  persistSiteToken: persistSiteTokenMock,
  TOKEN_KEY: "spots_token",
  SITE_GOOGLE_PENDING_KEY: "site_google_pending",
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("./book-panel", () => ({
  BookPanel: ({ venue, instanceKey }: { venue: { id: string }; instanceKey?: string }) => (
    <div data-testid="book-panel" data-venue-id={venue.id} data-instance-key={instanceKey ?? ""} />
  )
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Tester", email_verified_at: "2026-08-22T10:00:00.000Z", phone_verified_at: "2026-08-22T10:00:00.000Z" },
    loading: false,
    setUser: setUserMock,
    logout: vi.fn()
  })
}));

vi.mock("@myslot/auth", () => ({
  finishGoogleRedirect: vi.fn(async () => null),
  toAppUser: vi.fn((c) => c)
}));

const venue = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  status: "approved" as const,
  description: null,
  address: "1 St",
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
});

const business = { id: "biz-1", name: "Court Group", brand: { tagline: "Book direct" } };

function config(instance: { default_venue_id: string | null; allow_venue_choice: boolean }, venues: ReturnType<typeof venue>[]) {
  return { business, instance: { id: "inst-1", name: "Main", ...instance }, venues };
}

function wrap(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("WidgetEmbed venue step (ticket 06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlagsMock.mockResolvedValue({ brand_name: "MySlot.LK", app_url: "https://app.myslot.lk" });
    bookingsListMock.mockResolvedValue([]);
  });

  it("shows the venue selector with the default preselected for a multi-venue instance", async () => {
    const v1 = venue("v1", "Smash Arena");
    const v2 = venue("v2", "Green Turf");
    configMock.mockResolvedValue(config({ default_venue_id: "v2", allow_venue_choice: true }, [v1, v2]));

    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText("Choose venue")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const pickers = buttons.filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(pickers).toHaveLength(2);
    expect(screen.getByText("Smash Arena")).toBeInTheDocument();
    expect(screen.getByText("Green Turf")).toBeInTheDocument();
    expect(screen.getByText("Green Turf").closest("button")!.getAttribute("aria-pressed")).toBe("true");

    // The default venue drives the booking panel
    expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v2");
    expect(screen.getByTestId("book-panel").dataset.instanceKey).toBe("k1");
  });

  it("hides the selector when the instance locks venue choice", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena"), venue("v2", "Green Turf")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
    expect(screen.queryByText("Choose venue")).not.toBeInTheDocument();
    expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v1");
  });

  it("hides the selector for a single-venue business", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: null, allow_venue_choice: true }, [venue("v1", "Smash Arena")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
    expect(screen.queryByText("Choose venue")).not.toBeInTheDocument();
  });

  it("shows no preselect when the instance has no default venue", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: null, allow_venue_choice: true }, [venue("v1", "Smash Arena"), venue("v2", "Green Turf")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText("Choose venue")).toBeInTheDocument();
    });
    const pressed = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(0);
    expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v1");
  });

  it("switching venue moves the booking panel to the new venue", async () => {
    const v1 = venue("v1", "Smash Arena");
    const v2 = venue("v2", "Green Turf");
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: true }, [v1, v2]));

    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v1");
    });

    await userEvent.click(screen.getByText("Green Turf"));
    await waitFor(() => {
      expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v2");
    });
    expect(screen.getByText("Green Turf").closest("button")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the venue name even when venue choice is locked (multi-venue)", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena"), venue("v2", "Green Turf")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
    // The locked venue is the ONLY venue the visitor can book — its name must
    // lead the header (prominent), with the business name as the eyebrow.
    expect(screen.getByText("Smash Arena", { selector: "h1" })).toBeInTheDocument();
    expect(screen.getByText("Court Group")).toBeInTheDocument();
    expect(screen.queryByText(/Green Turf/, { selector: "h1, p" })).not.toBeInTheDocument();
  });

  it("shows the venue name for a locked single-venue widget", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
    expect(screen.getByText("Smash Arena", { selector: "h1" })).toBeInTheDocument();
  });

  it("renders the domain denial state for an unauthorized origin", async () => {
    configMock.mockRejectedValue({ code: "WIDGET_DOMAIN_NOT_ALLOWED", message: "nope" });
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText("Widget not authorized here")).toBeInTheDocument();
    });
  });

  it("renders the Powered by attribution linking to the platform app", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    const link = await screen.findByRole("link", { name: /Powered by MySlot\.LK/ });
    expect(link).toHaveAttribute("href", "https://app.myslot.lk");
    expect(link).toHaveAttribute("target", "_top");
  });

  it("falls back to MySlot.LK and the widget's own origin when flags are missing", async () => {
    featureFlagsMock.mockResolvedValue({ brand_name: undefined, app_url: null });
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    const link = await screen.findByRole("link", { name: /Powered by MySlot\.LK/ });
    expect(link).toHaveAttribute("href", window.location.origin);
  });

  it("shows the signed-in identity and a Sign out action in the header", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/tester/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

it("toggles the Your-bookings panel and requests the venue-scoped bookings", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));
    // The server returns only this venue's bookings (venue_id param); the
    // widget renders them without a client-side filter.
    bookingsListMock.mockResolvedValue([
      {
        id: "bk-1",
        court_id: "c1",
        user_id: "u1",
        venue_id: "v1",
        start_at: "2026-09-01T10:00:00+05:30",
        end_at: "2026-09-01T11:00:00+05:30",
        price_per_slot: 1500,
        total_price: 1500,
        status: "confirmed",
        court_name: "Court 1"
      }
    ]);
    wrap(<WidgetEmbed widgetKey="k1" />);
    await screen.findByText("Your bookings");
    await userEvent.click(screen.getByRole("button", { name: /your bookings/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /your bookings/i })).toBeInTheDocument();
      expect(screen.getByText("Court 1")).toBeInTheDocument();
      expect(bookingsListMock).toHaveBeenCalledWith("upcoming", { venue_id: "v1" });
    });

    await userEvent.click(screen.getAllByRole("button", { name: /back to booking/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
  });

  it("settles a site-mode Google redirect as this Business's Site Customer, never persisting the Firebase token", async () => {
    const { finishGoogleRedirect, toAppUser } = await import("@myslot/auth");
    vi.mocked(finishGoogleRedirect).mockResolvedValue({ idToken: "google-id-token" });
    vi.mocked(toAppUser).mockImplementation((c) => c);
    window.sessionStorage.setItem("site_google_pending", "courtgroup.lk");
    siteGoogleMock.mockResolvedValue({
      token: "sc-token",
      customer: { id: "sc-1", email: "g@pam.test", name: "G Pam", phone: null, email_verified_at: "2026-08-22T10:00:00.000Z", phone_verified_at: null }
    });
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));

    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(siteGoogleMock).toHaveBeenCalledWith({ site_hostname: "courtgroup.lk", id_token: "google-id-token" });
    });
    expect(persistSiteTokenMock).toHaveBeenCalledWith("sc-token");
    expect(setUserMock).toHaveBeenCalledWith({ id: "sc-1", email: "g@pam.test", name: "G Pam", phone: null, email_verified_at: "2026-08-22T10:00:00.000Z", phone_verified_at: null });
    expect(window.sessionStorage.getItem("site_google_pending")).toBeNull();
    expect(window.localStorage.getItem("spots_token")).toBeNull();
  });

  it("settles a marketplace (non-site) Google redirect into the platform token", async () => {
    const { finishGoogleRedirect } = await import("@myslot/auth");
    vi.mocked(finishGoogleRedirect).mockResolvedValue({ idToken: "google-id-token" });
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena")]));

    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(window.localStorage.getItem("spots_token")).toBe("google-id-token");
    });
    expect(siteGoogleMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("site_google_pending")).toBeNull();
  });
});
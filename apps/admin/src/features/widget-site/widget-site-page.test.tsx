import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WidgetSitePage } from "./widget-site-page";

const { meMock, instancesMock, updateMeMock, createMock, updateMock, deleteMock, flagsMock, siteRequestMock, setListingMock } = vi.hoisted(
  () => ({
    meMock: vi.fn(),
    instancesMock: vi.fn(),
    updateMeMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    flagsMock: vi.fn(),
    siteRequestMock: vi.fn(),
    setListingMock: vi.fn()
  })
);

vi.mock("@myslot/api", () => ({
  business: {
    me: meMock,
    updateMe: updateMeMock,
    widgetInstances: instancesMock,
    createWidgetInstance: createMock,
    updateWidgetInstance: updateMock,
    deleteWidgetInstance: deleteMock,
    siteRequest: siteRequestMock,
    setMarketplaceListing: setListingMock
  },
  featureFlags: { get: flagsMock },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

const profile = {
  id: "biz-1",
  name: "Court Group",
  brand: { colors: { primary: "#16a34a" }, tagline: "Book direct" },
  venues: [
    { id: "v1", name: "Smash Arena", status: "approved", visibility: "public" as const, slug: "smash-arena" },
    { id: "v2", name: "Green Turf", status: "approved", visibility: "public" as const, slug: "green-turf" }
  ]
};

const instance = {
    id: "inst-1",
    business_id: "biz-1",
    name: "Main website",
    embed_key: "abc123def4567890abc123def4567890",
    default_venue_id: "v1",
    default_venue_name: "Smash Arena",
    default_venue_status: "approved",
    allow_venue_choice: false,
    allowed_domains: ["thesite.com"],
    enabled: true
  };

  // A live-site business's venue (marketplace listing off, per ADR-0031) so
  // the listing toggle path is exercised.
  const liveProfile = {
    ...profile,
    site_hostname: "courtgroup.lk",
    venues: [{ ...profile.venues[0], marketplace_listing: false }]
  };

function wrap(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("WidgetSitePage (ticket 08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meMock.mockResolvedValue(profile);
    instancesMock.mockResolvedValue([instance]);
    flagsMock.mockResolvedValue({ app_url: "http://localhost:3000", brand_name: "MySlot.LK" });
    updateMeMock.mockResolvedValue(profile);
    createMock.mockResolvedValue({ ...instance });
    updateMock.mockResolvedValue({ ...instance, enabled: false });
    deleteMock.mockResolvedValue({ deleted: true });
    setListingMock.mockResolvedValue({});
  });

  it("renders the business brand editor and the instance list with embed keys", async () => {
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Business name")).toHaveValue("Court Group");
    });
    expect(screen.getByText("Main website")).toBeInTheDocument();
    expect(screen.getByText("/embed/abc123def4567890abc123def4567890")).toBeInTheDocument();
    // Locked to the default venue is surfaced on the badge
    expect(screen.getByText(/Live · locked to default/i)).toBeInTheDocument();
    expect(screen.getByText(/Default: Smash Arena/i)).toBeInTheDocument();
  });

  it("saves the business brand via the business profile endpoint", async () => {
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Business name")).toHaveValue("Court Group");
    });
    await userEvent.clear(screen.getByLabelText("Business name"));
    await userEvent.type(screen.getByLabelText("Business name"), "Court Group HQ");
    await userEvent.click(screen.getByRole("button", { name: "Save brand" }));

    await waitFor(() => {
      expect(updateMeMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Court Group HQ", brand: expect.objectContaining({ tagline: "Book direct" }) })
      );
    });
  });

  it("renders one Business brand editor with every section (brand-consolidation 03)", async () => {
    meMock.mockResolvedValue({
      ...profile,
      brand: {
        colors: { primary: "#16a34a" },
        tagline: "Book direct",
        about: "We run courts since 1998.",
        banner_image: "https://cdn.test/banner.jpg",
        contact: { phone: "+94 77 000 0000", email: "hello@courtgroup.lk" },
        social_links: { facebook: "https://facebook.com/courtgroup" }
      }
    });
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByText("Business brand")).toBeInTheDocument();
    });
    // All sections render in the one card — no duplicate editors.
    expect(screen.getByLabelText("Business name")).toHaveValue("Court Group");
    expect(screen.getByLabelText("Site banner")).toHaveValue("https://cdn.test/banner.jpg");
    expect(screen.getByLabelText("Contact phone")).toHaveValue("+94 77 000 0000");
    expect(screen.getByLabelText("Facebook URL")).toHaveValue("https://facebook.com/courtgroup");
    expect(screen.getByLabelText("Privacy policy")).toBeInTheDocument();
    expect(screen.getByLabelText("Terms & conditions")).toBeInTheDocument();
    // The separate "Site brand" / "Site policies" cards and their buttons are gone.
    expect(screen.queryByText("Site brand")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save site brand" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save policies" })).toBeNull();
    // The retired headline field is gone; the Preview button is gone too.
    expect(screen.queryByLabelText("Headline")).toBeNull();
    expect(screen.queryByRole("button", { name: /preview/i })).toBeNull();
  });

  it("saves every brand field through the single Save brand button (brand-consolidation 03)", async () => {
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save brand" })).toBeInTheDocument();
    });
    await userEvent.type(screen.getByLabelText("Site banner"), "https://cdn.test/banner.jpg");
    await userEvent.type(screen.getByLabelText("Contact email"), "hello@courtgroup.lk");
    await userEvent.type(screen.getByLabelText("Instagram URL"), "https://instagram.com/courtgroup");
    await userEvent.type(screen.getByLabelText("Privacy policy"), "We keep your data private.");
    await userEvent.type(screen.getByLabelText("Terms & conditions"), "Bookings follow venue rules.");
    await userEvent.click(screen.getByRole("button", { name: "Save brand" }));

    await waitFor(() => {
      expect(updateMeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Court Group",
          brand: expect.objectContaining({
            banner_image: "https://cdn.test/banner.jpg",
            contact: expect.objectContaining({ email: "hello@courtgroup.lk" }),
            social_links: expect.objectContaining({ instagram: "https://instagram.com/courtgroup" }),
            privacy_policy: "We keep your data private.",
            terms_conditions: "Bookings follow venue rules."
          })
        })
      );
    });
    // Exactly one save path — the same endpoint every section goes through.
    expect(updateMeMock).toHaveBeenCalledTimes(1);
  });

  it("creates an instance from the dialog with a locked default", async () => {
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new instance/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /new instance/i }));

    const nameInput = screen.getAllByLabelText("Name");
    await userEvent.type(nameInput[nameInput.length - 1], "Weekend page");
    await userEvent.click(screen.getByRole("button", { name: "Create instance" }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Weekend page", allowed_domains: [] })
      );
    });
    expect(createMock.mock.calls[0][0].allow_venue_choice).toBe(true);
  });

  it("pauses an instance with the toggle", async () => {
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("inst-1", { enabled: false });
    });
  });

  it("deletes an instance after confirming, and copies the embed snippet", async () => {
    const clipboard = { writeText: vi.fn(async () => {}) };
    Object.assign(navigator, { clipboard });

    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete main website/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /delete main website/i }));
    await userEvent.click(screen.getByRole("button", { name: "Delete instance" }));
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("inst-1");
    });

    await userEvent.click(screen.getByRole("button", { name: /copy embed/i }));
    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:3000/embed/abc123def4567890abc123def4567890")
      );
    });
  });

  it("toggles a venue's marketplace listing for live-site businesses (ADR-0031)", async () => {
    meMock.mockResolvedValue(liveProfile);
    instancesMock.mockResolvedValue([]);
    siteRequestMock.mockResolvedValue({ id: "sr-1", status: "live", hostname: "courtgroup.lk", hostname_kind: "custom" });
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sell on the marketplace/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /sell on the marketplace/i }));
    await waitFor(() => {
      expect(setListingMock).toHaveBeenCalledWith("v1", true);
    });
  });

  it("toggles the per-Business require-second-factor switch (ticket 09)", async () => {
    wrap(<WidgetSitePage />);
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /require two-factor authentication/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("checkbox", { name: /require two-factor authentication/i }));
    await waitFor(() => {
      expect(updateMeMock).toHaveBeenCalledWith({ require_2fa: true });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/now required for every customer sign-in/i);
  });
});
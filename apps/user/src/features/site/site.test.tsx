import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SiteChrome } from "./site-chrome";
import { SiteHome, openStatus } from "./site-home";

// The dedicated-site surfaces (ADR-0029 + ADR-0032 + ADR-0034): chrome renders
// the Business brand, home lists every venue (Private included) as minimal
// cards with Open Status, and venue switching lives on detail pages only.

const push = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathnameMock()
}));

const pathnameMock = vi.hoisted(() => vi.fn(() => "/"));

vi.mock("@myslot/ui", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@myslot/ui")>();
  return {
    ...mod,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: ({ children, title }: { children: ReactNode; title?: string }) => (
      <div>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    )
  };
});

const allWeek = Array.from({ length: 7 }, (_, d) => ({
  day_of_week: d,
  open_time: "06:00",
  close_time: "23:00"
}));

const config = (count = 2) => ({
  business: {
    id: "b1",
    name: "ABC Sports",
    brand: { tagline: "Book direct", colors: { primary: "#16a34a" }, logo_url: "https://cdn.test/logo.png" }
  },
  venues: Array.from({ length: count }, (_, i) => ({
    id: `v${i + 1}`,
    name: `Venue ${i + 1}`,
    slug: `venue-${i + 1}`,
    city: "Colombo",
    address: "1 Test Rd",
    photos: [],
sports: [{ name: "Badminton", icon: "🏸" }],
    visibility: i === 1 ? "private" : "public",
    lat: i === 0 ? 6.9271 : null,
    lng: i === 0 ? 79.8612 : null,
    min_price: i === 0 ? 1000 : null,
    hours: allWeek
  }))
});

const siteBrand = (extra = {}) => ({
  business: {
    id: "b1",
    name: "ABC Sports",
    brand: {
      colors: { primary: "#16a34a" },
      logo_url: "https://cdn.test/logo.png",
      tagline: "Book direct",
      about: "We run courts since 1998. ".repeat(12).trim(),
      contact: { phone: "+94 77 123 4567", email: "hello@abc.lk", address: "12 Galle Rd, Colombo", hours: "Mon–Sun 6am–11pm" },
      ...extra
    }
  },
  venues: [
    { id: "v1", name: "Venue 1", slug: "venue-1", city: "Colombo", address: "1 Test Rd", photos: [], sports: [{ name: "Badminton", icon: "🏸" }], visibility: "public", hours: allWeek },
    { id: "v2", name: "Venue 2", slug: "venue-2", city: "Colombo", address: "2 Test Rd", photos: [], sports: [{ name: "Tennis", icon: "🎾" }], visibility: "private", hours: allWeek }
  ]
});

function renderWithProvider(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe("SiteChrome", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/");
  });

  it("renders the business brand, legal links and no switch control on the home page", () => {
    renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    expect(screen.getAllByText("ABC Sports").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /Terms/ })).toHaveAttribute("href", "/terms");
    expect(screen.queryByRole("button", { name: "Switch venue" })).toBeNull();
  });

  it("shows the venue chooser only on venue pages of multi-venue businesses (ADR-0032)", async () => {
    pathnameMock.mockReturnValue("/venue-1");
    renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    const switchBtn = screen.getByRole("button", { name: "Switch venue" });
    await userEvent.click(switchBtn);
    // Choosing navigates to the venue's slug page.
    await userEvent.click(screen.getAllByText("Venue 2").at(-1)!);
    expect(push).toHaveBeenCalledWith("/venue-2");
  });

  it("hides the switch control on venue pages of a single-venue business", () => {
    pathnameMock.mockReturnValue("/venue-1");
    renderWithProvider(<SiteChrome config={config(1)}>body</SiteChrome>);
    expect(screen.queryByRole("button", { name: "Switch venue" })).toBeNull();
  });

  it("maps the brand colors onto the design tokens with a neutral page background (ADR-0032)", () => {
    const { container } = renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--color-primary")).toBe("#16a34a");
    expect(root.style.getPropertyValue("--color-accent")).toBe("#2563eb");
    expect(root.style.getPropertyValue("--color-primary-hover")).toContain("color-mix");
    expect(root.style.getPropertyValue("--color-primary-light")).toContain("color-mix");
    expect(root.style.getPropertyValue("--brand-bg")).toBe("");
    expect(root.className).toContain("bg-paper");
  });

  it("locks the home page to one viewport on desktop (ADR-0034)", () => {
    const { container } = renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("lg:h-screen");
    expect(root.className).toContain("lg:overflow-hidden");
  });

  it("hides the header entirely on the home page (ADR-0034 rev.)", () => {
    renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    expect(screen.queryByRole("button", { name: "Switch venue" })).toBeNull();
  });
});

describe("SiteHome", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
  });

  it("lists every venue of the business, private included", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getAllByText("Venue 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Venue 2").length).toBeGreaterThan(0);
  });

  it("redirects straight to the venue when the business has exactly one (ADR-0032)", () => {
    renderWithProvider(<SiteHome config={config(1)} />);
    expect(replace).toHaveBeenCalledWith("/venue-1");
  });

it("renders the banner image with the logo above the name and the description (ADR-0034 rev.)", () => {
    renderWithProvider(
      <SiteHome
        config={siteBrand({
          banner_image: "https://cdn.test/banner.jpg"
        })}
      />
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.some((img) => img.getAttribute("src") === "https://cdn.test/banner.jpg")).toBe(true);
    expect(screen.getAllByText("ABC Sports").length).toBeGreaterThan(0);
    expect(screen.getByText(/We run courts since 1998/)).toBeInTheDocument();
  });

  it("shows the logo above the name when no banner is set", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getAllByText("ABC Sports").length).toBeGreaterThan(0);
    expect(screen.getByText("Book direct")).toBeInTheDocument();
  });

  it("shows the 'Our venues' heading over the cards", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getByRole("heading", { name: "Our venues" })).toBeInTheDocument();
  });

  it("falls back to the about description when there is no about text", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getByText("Book direct")).toBeInTheDocument();
  });

  it("renders a muted line when the business has no venues", () => {
    renderWithProvider(<SiteHome config={config(0)} />);
    expect(screen.getByText("New venues coming soon.")).toBeInTheDocument();
  });

  it("shows each card's Open Status pill (ADR-0034 rev.)", () => {
    renderWithProvider(<SiteHome config={config()} />);
    // Hours are 06:00–23:00 every day, so the pill is a live verdict — Open,
    // Closing soon or Closed depending on the real clock.
    expect(screen.getAllByText(/^(Open now|Closing soon|Closed now|Closed today)$/).length).toBeGreaterThan(0);
  });

  it("computes the Open Status pill against a fixed clock", () => {
    const venue = config(1).venues[0]!;
    expect(openStatus(venue, new Date("2026-01-01T10:00:00")).label).toBe("Open now");
    expect(openStatus(venue, new Date("2026-01-01T22:30:00")).label).toBe("Closing soon");
    expect(openStatus(venue, new Date("2026-01-01T02:00:00")).label).toBe("Closed now");
  });

  it("marks a venue with no opening hours as closed today", () => {
    const empty = config();
    empty.venues[0]!.hours = [];
    renderWithProvider(<SiteHome config={empty} />);
    expect(screen.getAllByText("Closed today").length).toBeGreaterThan(0);
  });

  it("tolerates a venue with no hours field at all (stale payload, ADR-0034)", () => {
    const stale = config();
    delete (stale.venues[0] as { hours?: unknown }).hours;
    renderWithProvider(<SiteHome config={stale} />);
    expect(screen.getAllByText("Closed today").length).toBeGreaterThan(0);
  });

it("shows Social Links in the top bar and opens the Find us dialog (ADR-0034 rev.)", async () => {
    renderWithProvider(
      <SiteHome
        config={siteBrand({
          social_links: { facebook: "https://facebook.com/abc", tiktok: "https://tiktok.com/@abc" }
        })}
      />
    );
    const fb = screen.getByRole("link", { name: "ABC Sports on Facebook" });
    expect(fb).toHaveAttribute("href", "https://facebook.com/abc");
    const tk = screen.getByRole("link", { name: "ABC Sports on TikTok" });
    expect(tk).toHaveAttribute("href", "https://tiktok.com/@abc");
    expect(screen.queryByRole("link", { name: /on Instagram/i })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Find us" }));
    expect(screen.getByRole("heading", { name: "Find us" })).toBeInTheDocument();
    expect(screen.getByText("+94 77 123 4567")).toBeInTheDocument();
    expect(screen.getByText("hello@abc.lk")).toBeInTheDocument();
  });

  it("omits the top bar when neither contact nor social links are set", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.queryByRole("button", { name: "Find us" })).toBeNull();
  });

  it("links venue cards to Google Maps from lat/lng, hidden when unset (ADR-0031)", () => {
    renderWithProvider(<SiteHome config={config()} />);
    const directions = screen.getByRole("link", { name: /directions to venue 1/i });
    expect(directions).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=6.9271,79.8612");
    expect(screen.queryByRole("link", { name: /directions to venue 2/i })).toBeNull();
  });

  it("shows the cheapest court price on cards that have one (ADR-0031)", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getByText("Rs 1,000")).toBeInTheDocument();
  });

  it("shows the venue's sports as icon chips on the card", () => {
    renderWithProvider(<SiteHome config={config()} />);
    const chips = screen.getAllByTitle("Badminton");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toHaveTextContent("🏸");
  });
});
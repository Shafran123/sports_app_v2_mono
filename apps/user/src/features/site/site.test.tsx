import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SiteChrome } from "./site-chrome";
import { SiteHome } from "./site-home";

// The dedicated-site surfaces (ADR-0029 + ADR-0032): chrome renders the
// Business brand, home lists every venue (Private included), the hero is the
// Site Gallery carousel, and venue switching lives on detail pages only.

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
      open ? <div data-testid="venue-picker">{children}</div> : null,
    DialogContent: ({ children, title }: { children: ReactNode; title?: string }) => (
      <div data-testid="venue-picker-content">
        {title && <h2>{title}</h2>}
        {children}
      </div>
    )
  };
});

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
    sports: ["Badminton"],
    visibility: i === 1 ? "private" : "public",
    lat: i === 0 ? 6.9271 : null,
    lng: i === 0 ? 79.8612 : null,
    min_price: i === 0 ? 1000 : null
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
      hero_image: "https://cdn.test/hero.jpg",
      headline: "Colombo’s home of badminton",
      about: "We run courts since 1998. ".repeat(12).trim(),
      contact: { phone: "+94 77 123 4567", email: "hello@abc.lk", address: "12 Galle Rd, Colombo", hours: "Mon–Sun 6am–11pm" },
      ...extra
    }
  },
  venues: [
    { id: "v1", name: "Venue 1", slug: "venue-1", city: "Colombo", address: "1 Test Rd", photos: [], sports: ["Badminton"], visibility: "public" },
    { id: "v2", name: "Venue 2", slug: "venue-2", city: "Colombo", address: "2 Test Rd", photos: [], sports: ["Tennis"], visibility: "private" }
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
    expect(screen.getByTestId("venue-picker")).toBeTruthy();
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

  it("renders the hero gallery with captions and the name + description overlay (no CTA)", () => {
    renderWithProvider(
      <SiteHome
        config={siteBrand({
          gallery: [
            { image_url: "https://cdn.test/slide1.jpg", caption: "Our main hall at dawn" },
            { image_url: "https://cdn.test/slide2.jpg", caption: "Tournament night" }
          ]
        })}
      />
    );
    const slides = screen.getAllByRole("img");
    expect(slides[0]).toHaveAttribute("src", "https://cdn.test/slide1.jpg");
    // The brand block lives in the hero overlay now — no separate intro.
    expect(screen.getAllByText("ABC Sports").length).toBeGreaterThan(0);
    expect(screen.getByText("Our main hall at dawn")).toBeInTheDocument();
    expect(screen.getByText("Tournament night")).toBeInTheDocument();
    expect(screen.getByText(/We run courts since 1998/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book now" })).toBeNull();
  });

  it("falls back to the about description when there is no about text", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getByText("Book direct")).toBeInTheDocument();
  });

  it("falls back to the legacy hero image, then the logo, when no gallery is set", () => {
    renderWithProvider(<SiteHome config={siteBrand()} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.test/hero.jpg");
  });

  it("hides the hero entirely when no gallery, hero or logo exists", () => {
    renderWithProvider(<SiteHome config={siteBrand({ logo_url: "", hero_image: "" })} />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("renders the contact strip when contact fields exist and omits it otherwise", () => {
    renderWithProvider(<SiteHome config={siteBrand()} />);
    expect(screen.getByText("+94 77 123 4567")).toBeInTheDocument();
    expect(screen.getByText("hello@abc.lk")).toBeInTheDocument();
    expect(screen.getByText("Mon–Sun 6am–11pm")).toBeInTheDocument();
  });

  it("hides the contact strip when no contact fields are set", () => {
    renderWithProvider(<SiteHome config={siteBrand({ contact: {} })} />);
    expect(screen.queryByText("hello@abc.lk")).toBeNull();
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
});
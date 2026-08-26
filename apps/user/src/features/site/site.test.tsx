import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SiteChrome } from "./site-chrome";
import { SiteHome } from "./site-home";

// The dedicated-site surfaces (ADR-0029): chrome renders the Business brand,
// home lists every venue (Private included), and the first-visit picker opens
// for multi-venue businesses.

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@myslot/ui", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@myslot/ui")>();
  return {
    ...mod,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div data-testid="site-picker">{children}</div> : null,
    DialogContent: ({ children, title }: { children: ReactNode; title?: string }) => (
      <div data-testid="site-picker-content">
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
  it("renders the business brand and a switch-venue control for multi-venue businesses", () => {
    renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    expect(screen.getAllByText("ABC Sports").length).toBeGreaterThan(0);
    // Header tagline + footer tagline both render the brand copy.
    expect(screen.getAllByText("Book direct").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Switch venue" })).toHaveAttribute("href", "/?pick=1");
  });

  it("hides the switch control for a single-venue business", () => {
    renderWithProvider(<SiteChrome config={config(1)}>body</SiteChrome>);
    expect(screen.queryByRole("link", { name: "Switch venue" })).toBeNull();
  });

  it("maps the brand colors onto the design tokens so the whole site is branded (ADR-0031)", () => {
    const { container } = renderWithProvider(<SiteChrome config={config()}>body</SiteChrome>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--color-primary")).toBe("#16a34a");
    expect(root.style.getPropertyValue("--color-accent")).toBe("#2563eb");
    expect(root.style.getPropertyValue("--color-primary-hover")).toContain("color-mix");
    expect(root.style.getPropertyValue("--color-primary-light")).toContain("color-mix");
    expect(root.style.getPropertyValue("--brand-bg")).toContain("color-mix");
  });
});

describe("SiteHome", () => {
  beforeEach(() => {
    // The vitest environment here has no real localStorage — SiteHome reads
    // and writes a per-hostname dismissal key.
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        clear: () => store.clear()
      },
      configurable: true
    });
    push.mockClear();
  });

  it("lists every venue of the business, private included", async () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getAllByText("Venue 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Venue 2").length).toBeGreaterThan(0);
  });

  it("opens the venue picker on first visit and navigates on selection", async () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getByTestId("site-picker")).toBeTruthy();
    // The venue name appears both on the page card and inside the picker —
    // click the picker's copy.
    const pickerVenue = screen.getAllByText("Venue 2").at(-1)!;
    await userEvent.click(pickerVenue);
    expect(push).toHaveBeenCalledWith("/venue-2");
  });

  it("remembers dismissal so the picker does not auto-reopen", async () => {
    localStorage.setItem(`site-picker-dismissed-${window.location.hostname}`, "1");
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.queryByTestId("site-picker")).toBeNull();
  });

  it("renders the site-brand hero: hero image, headline, about and book-now CTA (ADR-0031)", () => {
    renderWithProvider(<SiteHome config={siteBrand()} />);
    const hero = screen.getByAltText("ABC Sports");
    expect(hero).toHaveAttribute("src", "https://cdn.test/hero.jpg");
    expect(screen.getByText("Colombo’s home of badminton")).toBeInTheDocument();
    expect(screen.getByText(/We run courts since 1998/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book now" })).toBeInTheDocument();
  });

  it("falls back to the logo/venue photo and tagline when no hero is set", () => {
    renderWithProvider(<SiteHome config={config()} />);
    expect(screen.getByAltText("ABC Sports")).toHaveAttribute("src", "https://cdn.test/logo.png");
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
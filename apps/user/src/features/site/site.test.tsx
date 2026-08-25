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
    visibility: i === 1 ? "private" : "public"
  }))
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
});
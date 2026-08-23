import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { featureFlagsGetMock, leadsSubmitMock } = vi.hoisted(() => ({
  featureFlagsGetMock: vi.fn(),
  leadsSubmitMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  featureFlags: { get: featureFlagsGetMock },
  leads: { submit: leadsSubmitMock },
  toApiFailure: () => ({ code: "TEST", status: 500, message: "Something went wrong" })
}));

import { LandingPage } from "./landing-page";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  featureFlagsGetMock.mockResolvedValue({ brand_name: "MySlot.LK" });
  return render(
    <QueryClientProvider client={client}>
      <LandingPage />
    </QueryClientProvider>
  );
}

describe("LandingPage", () => {
  it("renders the demo hero CTA scrolling to the inquiry form", () => {
    renderPage();
    const cta = screen.getByRole("link", { name: /book a demo with us/i });
    expect(cta).toHaveAttribute("href", "#inquire");
  });

  it("renders a text-only trial band with no CTA button", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /list your venue free for 3 months/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /claim your free trial/i })).not.toBeInTheDocument();
  });

  it("renders the For players nav link pointing at the player app", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "For players" })).toHaveAttribute("href", "http://localhost:3000");
  });

  it("renders a mobile demo CTA in the header", () => {
    renderPage();
    const mobileCta = screen.getByRole("link", { name: "Book a demo" });
    expect(mobileCta).toHaveAttribute("href", "#inquire");
  });

  it("renders the two player feature sections after the owner features", () => {
    renderPage();
    expect(screen.getByText(/pick a court, pick a slot/i)).toBeInTheDocument();
    expect(screen.getByText(/your booking, qr-ready/i)).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /explore the player app/i })) {
      expect(link).toHaveAttribute("href", "http://localhost:3000");
    }
  });

  it("renders the real product screenshots in the phone-framed slots", () => {
    renderPage();
    expect(screen.getByRole("img", { name: /screenshot: pick a court, pick a slot/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /screenshot: your booking, qr-ready/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /screenshot: player app — find your game/i })).not.toBeInTheDocument();
  });

  it("has no photo strip and no social proof sections", () => {
    renderPage();
    expect(screen.queryByText(/real courts, real games/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/50\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/as han fernando/i)).not.toBeInTheDocument();
  });

  it("keeps the trial band sub honest at pre-launch", () => {
    renderPage();
    expect(screen.queryByText(/thousands of players/i)).not.toBeInTheDocument();
    expect(screen.getByText(/be one of the first venues on it/i)).toBeInTheDocument();
  });

  it("renders the nav at the top with the hero headline", () => {
    renderPage();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "List your venue" })).toHaveAttribute("href", "#inquire");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/booked-out/i);
  });

  it("rotates the one-word headline as the only USP", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).not.toHaveTextContent(/booked-out courts/i);
    expect(h1).not.toHaveTextContent(/handled for you/i);
    expect(h1.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^booked-out$/i);
  });

  it("renders the scroll cue linking to how it works", () => {
    renderPage();
    const cue = screen.getByRole("link", { name: /scroll to see how it works/i });
    expect(cue).toHaveAttribute("href", "#how-it-works");
  });

  it("renders a transparent non-sticky header with a filled demo CTA", () => {
    renderPage();
    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("sticky");
    const desktopCta = within(header).getByRole("link", { name: "List your venue" });
    expect(desktopCta).toHaveClass("bg-primary");
  });

  it("renders the one-word rotating USP as the headline, no phrase prefix", () => {
    renderPage();
    expect(screen.queryByText(/for venue owners/i)).not.toBeInTheDocument();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).not.toHaveTextContent(/booked-out courts,/i);
    expect(h1.querySelector('[aria-hidden="true"]')).toHaveTextContent(/booked-out/i);
    expect(h1.className).toContain("md:text-8xl");
  });

  it("footer lists Contact as a mailto and no player-app link or About link", () => {
    renderPage();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Contact" })).toHaveAttribute("href", "mailto:info@myslot.lk");
    expect(within(footer).queryByRole("link", { name: "Explore the player app" })).not.toBeInTheDocument();
    expect(within(footer).queryByRole("link", { name: "About" })).not.toBeInTheDocument();
  });
});
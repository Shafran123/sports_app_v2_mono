import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("img", { name: /screenshot: player app — find your game/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /screenshot: pick a court, pick a slot/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /screenshot: your booking, qr-ready/i })).toBeInTheDocument();
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
});
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

  it("renders the two player feature sections after the owner features", () => {
    renderPage();
    expect(screen.getByText(/pick a court, pick a slot/i)).toBeInTheDocument();
    expect(screen.getByText(/your booking, qr-ready/i)).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: /explore the player app/i })) {
      expect(link).toHaveAttribute("href", "http://localhost:3000");
    }
  });

  it("renders the photo strip with real court images", () => {
    renderPage();
    expect(screen.getByRole("img", { name: /badminton courts with lined flooring/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /football turf under floodlights/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /cricket nets ready for practice/i })).toBeInTheDocument();
  });

  it("renders the social proof stats and testimonials", () => {
    renderPage();
    expect(screen.getByText("50+")).toBeInTheDocument();
    expect(screen.getByText("10k+")).toBeInTheDocument();
    expect(screen.getByText(/my courts used to be empty on weekdays/i)).toBeInTheDocument();
  });
});
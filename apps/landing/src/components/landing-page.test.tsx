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

  it("has no header — the logo lives at the top of the hero", () => {
    renderPage();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    const hero = screen.getByRole("heading", { level: 1 }).parentElement;
    expect(hero).toBeInTheDocument();
    expect(within(hero as HTMLElement).getAllByText(/MySlot/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/booked-out/i);
  });

  it("pitches the dedicated website to owners and drops players, payments, and events", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /your venue, on its own dedicated website/i })).toBeInTheDocument();
    expect(screen.getAllByText(/own website/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/pick a court, pick a slot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your booking, qr-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payments your way/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/events & registrations/i)).not.toBeInTheDocument();
  });

  it("renders the four real screenshots in their device frames", () => {
    renderPage();
    expect(screen.getByRole("img", { name: /screenshot: your venue's own website/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /screenshot: bookings — live slot grid/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /screenshot: front-desk & walk-in check-ins/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /screenshot: dashboard — your venue's day/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /screenshot: events & registrations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /screenshot: payments & reports/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /screenshot: player app — find your game/i })).not.toBeInTheDocument();
  });

  it("renders the what-you-get capabilities table", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /everything that comes with your venue/i })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /embeddable booking widget/i })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /variable pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /a clear plan & agreement/i })).toBeInTheDocument();
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

  it("renders the rotating headline with the lead-in and fine print", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/book digitally,/i);
    const rotating = h1.querySelector('[aria-hidden="true"]');
    expect(rotating).toHaveTextContent(/^booked-out$/i);
    expect(rotating.className).toContain("text-primary");
    expect(screen.getByText(/3-month free trial for listed venues/i)).toBeInTheDocument();
  });

  it("renders the scroll cue linking to how it works", () => {
    renderPage();
    const cue = screen.getByRole("link", { name: /scroll to see how it works/i });
    expect(cue).toHaveAttribute("href", "#how-it-works");
  });

  it("renders the FAQ accordion on the page", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /questions, answered/i })).toBeInTheDocument();
    expect(screen.getByText(/do i really get my own dedicated website/i)).toBeInTheDocument();
    expect(screen.getByText(/how much does it cost to get started/i)).toBeInTheDocument();
  });

  it("shows the business contact block in the inquire section", () => {
    renderPage();
    const inquire = screen.getByRole("heading", { name: /^list your venue$/i }).closest("section");
    expect(inquire).toBeInTheDocument();
    expect(within(inquire as HTMLElement).getByText(/69 kongtree road, thalapitiya, galle/i)).toBeInTheDocument();
    expect(within(inquire as HTMLElement).getByRole("link", { name: "+94 77 171 3701" })).toHaveAttribute(
      "href",
      "tel:+94771713701"
    );
    expect(within(inquire as HTMLElement).getByRole("link", { name: "info@myslot.lk" })).toHaveAttribute(
      "href",
      "mailto:info@myslot.lk"
    );
  });

  it("footer lists Legal links, the address, and a tap-to-call number", () => {
    renderPage();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(within(footer).getAllByText(/69 kongtree road, thalapitiya, galle/i).length).toBeGreaterThan(0);
    expect(within(footer).getByRole("link", { name: "+94 77 171 3701" })).toHaveAttribute("href", "tel:+94771713701");
  });
});
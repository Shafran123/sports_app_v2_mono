import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VenueDetailPage } from "./venue-detail-page";

const { useSearchParams } = vi.hoisted(() => ({ useSearchParams: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => useSearchParams()
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "player", phone: "+94771234567", phone_verified_at: "2026-08-22T10:00:00.000Z" },
    loading: false,
    logout: vi.fn(),
    setUser: vi.fn()
  })
}));

vi.mock("@myslot/api", () => ({
  venues: {
    detail: vi.fn(),
    availability: vi.fn(),
    list: vi.fn(),
    mine: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    resubmit: vi.fn()
  },
  featureFlags: {
    get: vi.fn(async () => ({
      phone_verification_required: false,
      sms_enabled: true,
      payhere_enabled: true,
      events_discovery_state: "enabled",
      brand_name: "MySlot.LK"
    }))
  },
  siteCustomerAuth: { verifyPhoneSend: vi.fn(), verifyPhoneConfirm: vi.fn(), me: vi.fn() },
  isOwnerSurface: () => false,
  toApiFailure: (e: { code?: string; message?: string }) => ({ status: 0, code: e?.code ?? "UNKNOWN", message: e?.message ?? "err" }),
  getClient: vi.fn(),
  setClient: vi.fn()
}));

import { venues } from "@myslot/api";

const venue = {
  id: "v1",
  name: "Green Turf Colombo",
  status: "approved",
  description: null,
  address: "12 Havelock Road",
  city: "Colombo",
  lat: null,
  lng: null,
  phone: null,
  photos: [],
  amenities: [],
  rules: null,
  cancellation_policy: null,
  accepts_cash: true,
  venue_tax_rate: 0,
  advance_days: 14,
  sports: ["football"],
  hours: [],
  courts: [{ id: "c1", name: "Turf A", sport: "Football", price_per_slot: 4500, slot_duration_min: 60, is_indoor: false }]
};

const availability = {
  date: "2026-08-26",
  advance_days: 14,
  venue_offer: { discount_type: "percent", value: 20 },
  courts: [
    {
      court_id: "c1",
      name: "Turf A",
      sport: "Football",
      price_per_slot: 4500,
      slot_duration_min: 60,
      slots: [
        { start_at: "2026-08-26T03:00:00.000Z", end_at: "2026-08-26T04:00:00.000Z", state: "available", price: 4500, offer_price: null }
      ]
    }
  ]
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VenueDetailPage venueId="v1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(venues.detail).mockResolvedValue(venue as never);
  vi.mocked(venues.availability).mockResolvedValue(availability as never);
  useSearchParams.mockReturnValue(new URLSearchParams());
});

describe("venue-wide offer is applied once", () => {
  it("the checkout link carries the slot-level price, not the venue-wide-discounted price", async () => {
    renderPage();

    // Pick 1h duration via the duration select (labelled "Duration").
    const durationSelect = await screen.findByLabelText("Duration");
    await userEvent.selectOptions(durationSelect, "60");

    // Tap the available slot chip (aria-label begins with the court name).
    const slotButton = await screen.findByRole("button", { name: /Turf A, / });
    await userEvent.click(slotButton);

    // The Continue CTA reflects the venue-wide discounted total (Rs 3,600).
    // Two links render (desktop aside + mobile fixed bar); take the first.
    const links = await screen.findAllByRole("link", { name: /Continue/ });
    const link = links[0]!;
    const params = new URLSearchParams(new URL(link.getAttribute("href")!, "http://localhost").search);

    // price_per_slot must be the SLOT-level price (4500) so checkout applies
    // the venue-wide 20% exactly once (→ 3600), not a second time (→ 2880).
    expect(params.get("price_per_slot")).toBe("4500");
    expect(params.get("base_price_per_slot")).toBe("4500");
    expect(params.get("venue_offer_value")).toBe("20");
    expect(link.textContent).toContain("Rs 3,600");
  });
});

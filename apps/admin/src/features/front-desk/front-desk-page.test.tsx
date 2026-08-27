import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addDaysKey, toDateKey } from "@myslot/utils";
import { FrontDeskPage } from "./front-desk-page";

vi.mock("@myslot/api", () => ({
  business: { listBookings: vi.fn() },
  venues: { mine: vi.fn() }
}));

vi.mock("@/features/admin-calendar/booking-detail-dialog", () => ({
  BookingDetailDialog: () => null
}));
vi.mock("./qr-scan-dialog", () => ({ QrScanDialog: () => null }));
vi.mock("./quick-book-dialog", () => ({ QuickBookDialog: () => null }));
vi.mock("@/hooks/use-realtime", () => ({
  RealtimeBridge: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSocketStatus: () => "connected"
}));

import { business, venues } from "@myslot/api";

function mondayKey(offset: number): string {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return toDateKey(monday);
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    court_id: "c1",
    user_id: null,
    start_at: "2026-08-20T18:30:00+05:30",
    end_at: "2026-08-20T19:30:00+05:30",
    price_per_slot: 800,
    total_price: 800,
    status: "confirmed",
    payment_method: "cash",
    player_name: "Nimal",
    court_name: "Court 1",
    venue_name: "Badminton Arena",
    ...overrides
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrontDeskPage />
    </QueryClientProvider>
  );
}

describe("front desk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(venues.mine).mockResolvedValue([]);
    vi.mocked(business.listBookings).mockResolvedValue({ data: [], meta: { total: 0 } });
  });

  it("defaults to this week's bookings", async () => {
    renderPage();
    expect(await screen.findByText("No bookings in this range")).toBeInTheDocument();
    const monday = mondayKey(0);
    const sunday = addDaysKey(monday, 6);
    expect(business.listBookings).toHaveBeenCalledWith({ date_from: monday, date_to: sunday });
  });

  it("shows today's bookings when Today is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No bookings in this range");
    await user.click(screen.getByRole("button", { name: /today/i }));
    const today = toDateKey(new Date());
    expect(business.listBookings).toHaveBeenLastCalledWith({ date_from: today, date_to: today });
  });

  it("switches to next week with one click", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No bookings in this range");
    await user.click(screen.getByRole("button", { name: /next week/i }));
    const monday = mondayKey(1);
    const sunday = addDaysKey(monday, 6);
    expect(business.listBookings).toHaveBeenLastCalledWith({ date_from: monday, date_to: sunday });
  });

  it("narrows to a single day via the Mon-Sun chips", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("No bookings in this range");
    await user.click(screen.getByRole("tab", { name: /^mon/i }));
    const monday = mondayKey(0);
    expect(business.listBookings).toHaveBeenLastCalledWith({ date_from: monday, date_to: monday });
  });

  it("shows the date on each booking card", async () => {
    vi.mocked(business.listBookings).mockResolvedValue({
      data: [makeBooking()],
      meta: { total: 1 }
    });
    renderPage();
    const card = await screen.findByRole("button", { name: /nimal/i });
    expect(within(card).getByText(/20 aug/i)).toBeInTheDocument();
    expect(within(card).getByText("6:30 PM")).toBeInTheDocument();
  });

  it("separates pending bookings into their own section for the owner to confirm", async () => {
    vi.mocked(business.listBookings).mockResolvedValue({
      data: [
        makeBooking({ id: "b-pending", status: "pending", player_name: "Kumara" }),
        makeBooking({ id: "b-confirmed", status: "confirmed", player_name: "Nimal" }),
        makeBooking({ id: "b-completed", status: "completed", player_name: "Anusha" })
      ],
      meta: { total: 3 }
    });
    renderPage();

    const pendingSection = await screen.findByRole("region", { name: /pending confirmation/i });
    expect(within(pendingSection).getByText("Kumara")).toBeInTheDocument();
    expect(within(pendingSection).queryByText("Nimal")).not.toBeInTheDocument();

    const confirmedSection = screen.getByRole("region", { name: /confirmed bookings/i });
    expect(within(confirmedSection).getByText("Nimal")).toBeInTheDocument();
    expect(within(confirmedSection).queryByText("Kumara")).not.toBeInTheDocument();

    const pastSection = screen.getByRole("region", { name: /earlier or finished/i });
    expect(within(pastSection).getByText("Anusha")).toBeInTheDocument();
  });

  it("renders the socket status so the desk knows when updates stop", async () => {
    vi.mocked(business.listBookings).mockResolvedValue({
      data: [makeBooking()],
      meta: { total: 1 }
    });
    renderPage();
    await screen.findByRole("button", { name: /nimal/i });
    expect(screen.getByRole("status")).toHaveTextContent("Live");
  });
});

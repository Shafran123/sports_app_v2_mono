import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Venue } from "@myslot/types";
import { QuickBookDialog } from "./quick-book-dialog";

vi.mock("@myslot/api", () => ({
  venues: { mine: vi.fn(), availability: vi.fn() },
  business: { manualBooking: vi.fn() },
  toApiFailure: (e: unknown) => ({ message: (e as Error)?.message ?? "error", code: undefined })
}));

vi.mock("@myslot/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@myslot/ui")>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="qb-dialog">{children}</div> : null,
    DialogContent: ({ children, title }: { children: React.ReactNode; title?: string }) => (
      <div data-testid="qb-content">
        {title}
        {children}
      </div>
    )
  };
});

import { venues, business } from "@myslot/api";

const court = {
  court_id: "court-1",
  name: "Court 1",
  sport: "Badminton",
  price_per_slot: 1500,
  slot_duration_min: 60,
  slots: [
    { start_at: "2026-08-22T16:30:00+05:30", end_at: "2026-08-22T17:30:00+05:30", state: "available" },
    { start_at: "2026-08-22T17:30:00+05:30", end_at: "2026-08-22T18:30:00+05:30", state: "available" },
    { start_at: "2026-08-22T18:30:00+05:30", end_at: "2026-08-22T19:30:00+05:30", state: "available" },
    { start_at: "2026-08-22T19:30:00+05:30", end_at: "2026-08-22T20:30:00+05:30", state: "available" }
  ]
};

const availability = { date: "2026-08-22", courts: [court] };

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const venuesList = [{ id: "v1", name: "Badminton Arena" }] as Venue[];
  return render(
    <QueryClientProvider client={qc}>
      <QuickBookDialog open venues={venuesList} onOpenChange={() => {}} />
    </QueryClientProvider>
  );
}

describe("QuickBookDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(venues.availability).mockResolvedValue(availability as never);
    vi.mocked(business.manualBooking).mockResolvedValue({ data: { id: "bk1" } } as never);
  });

  it("asks for the duration before showing any start times (same as the player flow)", async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByRole("combobox", { name: /court/i });
    await user.selectOptions(screen.getByRole("combobox", { name: /court/i }), "court-1");

    expect(await screen.findByText(/pick a duration first/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /4:30 PM/i })).not.toBeInTheDocument();
  });

  it("selects a contiguous run when a start time is picked, and books it", async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByRole("combobox", { name: /court/i });
    await user.selectOptions(screen.getByRole("combobox", { name: /court/i }), "court-1");

    const duration = await screen.findByRole("combobox", { name: /duration/i });
    await user.selectOptions(duration, "120");

    const start = await screen.findByRole("button", { name: /4:30 PM/i });
    await user.click(start);

    const summary = await screen.findByText(/Court 1 · 4:30 PM – 6:30 PM/i);
    expect(summary).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/i)).toHaveValue(3000);

    await user.click(screen.getByRole("button", { name: /confirm booking/i }));
    expect(business.manualBooking).toHaveBeenCalledWith({
      court_id: "court-1",
      start_at: "2026-08-22T16:30:00+05:30",
      end_at: "2026-08-22T18:30:00+05:30",
      player_name: undefined,
      player_phone: undefined,
      amount: 3000
    });
  });

  it("only offers start times where the whole run fits", async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByRole("combobox", { name: /court/i });
    await user.selectOptions(screen.getByRole("combobox", { name: /court/i }), "court-1");

    const duration = await screen.findByRole("combobox", { name: /duration/i });
    await user.selectOptions(duration, "180");

    // 3h needs three contiguous slots. With four slots (4:30→8:30) only 4:30
    // and 5:30 can start it — 6:30 runs out of slots.
    await screen.findByRole("button", { name: /^4:30 PM/ });
    expect(screen.getByRole("button", { name: /^5:30 PM/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^6:30 PM/ })).not.toBeInTheDocument();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookingSettingsPage } from "./booking-settings-page";

const { getMock, updateMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  updateMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  business: {
    getBookingSettings: getMock,
    updateBookingSettings: updateMock
  },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BookingSettingsPage />
    </QueryClientProvider>
  );
}

describe("BookingSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ auto_confirm: true, pending_auto_cancel_hours: 4 });
    updateMock.mockResolvedValue({});
  });

  it("loads and renders the two booking settings", async () => {
    wrap();
    expect(await screen.findByRole("switch", { name: /auto-confirm bookings/i })).toBeChecked();
    expect(screen.getByLabelText(/pending auto-cancel hours/i)).toHaveValue(4);
  });

  it("saves the pending auto-cancel hours through the business settings endpoint", async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByRole("switch", { name: /auto-confirm bookings/i });

    await user.clear(screen.getByLabelText(/pending auto-cancel hours/i));
    await user.type(screen.getByLabelText(/pending auto-cancel hours/i), "6");
    await user.click(screen.getByRole("button", { name: /save booking settings/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ auto_confirm: true, pending_auto_cancel_hours: 6 });
    });
  });

  it("toggles auto-confirm off and saves it", async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByRole("switch", { name: /auto-confirm bookings/i });

    await user.click(screen.getByRole("switch", { name: /auto-confirm bookings/i }));
    await user.click(screen.getByRole("button", { name: /save booking settings/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ auto_confirm: false, pending_auto_cancel_hours: 4 });
    });
  });
});

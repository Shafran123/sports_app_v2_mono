import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsPage } from "./settings-page";

const { platformConfigMock, setConfigKeyMock, reportsMock, configAuditMock } = vi.hoisted(() => ({
  platformConfigMock: vi.fn(),
  setConfigKeyMock: vi.fn(),
  reportsMock: vi.fn(),
  configAuditMock: vi.fn()
}));

vi.mock("@spots/api", () => ({
  admin: {
    platformConfig: platformConfigMock,
    setConfigKey: setConfigKeyMock,
    reports: reportsMock,
    configAudit: configAuditMock
  },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

const flags = [
  {
    name: "phone_verification_required",
    type: "boolean",
    default: false,
    description: "Require a verified phone.",
    value: false
  },
  {
    name: "events_discovery_state",
    type: "enum",
    default: "enabled",
    description: "How events surface.",
    values: ["enabled", "coming_soon", "hidden"],
    value: "enabled"
  }
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SettingsPage />
    </QueryClientProvider>
  );
}

describe("SettingsPage flags tab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    platformConfigMock.mockResolvedValue({ flags, tax_rate: 0, brand_name: "Spots" });
    reportsMock.mockResolvedValue({
      range: 7,
      series: [{ day: "2026-08-22", bookings: 1, revenue: 900, tax: 0 }],
      by_sport: [],
      by_venue: [],
      payment_split: { online: { bookings: 0, revenue: 0 }, cash: { bookings: 1, revenue: 900 } },
      events: { registrations: 0, revenue: 0 }
    });
    configAuditMock.mockResolvedValue([]);
  });

  it("lists flags with their current state", async () => {
    renderPage();
    expect(await screen.findByText("phone_verification_required")).toBeInTheDocument();
    expect(screen.getByText("events_discovery_state")).toBeInTheDocument();
    expect(screen.getByDisplayValue("enabled")).toBeInTheDocument();
    const switchInput = screen.getByRole("checkbox");
    expect(switchInput).not.toBeChecked();
  });

  it("saves a boolean flag flip", async () => {
    setConfigKeyMock.mockResolvedValue({ name: "phone_verification_required", value: true });
    renderPage();
    await screen.findByText("phone_verification_required");

    const toggle = screen.getByRole("checkbox");
    await userEvent.click(toggle);

    await waitFor(() => expect(setConfigKeyMock).toHaveBeenCalledWith("phone_verification_required", true));
  });
});
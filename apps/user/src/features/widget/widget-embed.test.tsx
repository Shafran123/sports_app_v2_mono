import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WidgetEmbed } from "./widget-embed";

const { configMock } = vi.hoisted(() => ({ configMock: vi.fn() }));

vi.mock("@myslot/api", () => ({
  widget: { config: configMock },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("./book-panel", () => ({
  BookPanel: ({ venue, instanceKey }: { venue: { id: string }; instanceKey?: string }) => (
    <div data-testid="book-panel" data-venue-id={venue.id} data-instance-key={instanceKey ?? ""} />
  )
}));

const venue = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  status: "approved" as const,
  description: null,
  address: "1 St",
  city: "Colombo",
  phone: null,
  photos: [],
  amenities: [],
  rules: null,
  cancellation_policy: null,
  accepts_cash: true,
  venue_tax_rate: 0,
  advance_days: 14,
  sports: ["Badminton"],
  courts: [],
  hours: []
});

const business = { id: "biz-1", name: "Court Group", brand: { tagline: "Book direct" } };

function config(instance: { default_venue_id: string | null; allow_venue_choice: boolean }, venues: ReturnType<typeof venue>[]) {
  return { business, instance: { id: "inst-1", name: "Main", ...instance }, venues };
}

function wrap(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("WidgetEmbed venue step (ticket 06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the venue selector with the default preselected for a multi-venue instance", async () => {
    const v1 = venue("v1", "Smash Arena");
    const v2 = venue("v2", "Green Turf");
    configMock.mockResolvedValue(config({ default_venue_id: "v2", allow_venue_choice: true }, [v1, v2]));

    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText("Choose venue")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const pickers = buttons.filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(pickers).toHaveLength(2);
    expect(screen.getByText("Smash Arena")).toBeInTheDocument();
    expect(screen.getByText("Green Turf")).toBeInTheDocument();
    expect(screen.getByText("Green Turf").closest("button")!.getAttribute("aria-pressed")).toBe("true");

    // The default venue drives the booking panel
    expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v2");
    expect(screen.getByTestId("book-panel").dataset.instanceKey).toBe("k1");
  });

  it("hides the selector when the instance locks venue choice", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: false }, [venue("v1", "Smash Arena"), venue("v2", "Green Turf")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
    expect(screen.queryByText("Choose venue")).not.toBeInTheDocument();
    expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v1");
  });

  it("hides the selector for a single-venue business", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: null, allow_venue_choice: true }, [venue("v1", "Smash Arena")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel")).toBeInTheDocument();
    });
    expect(screen.queryByText("Choose venue")).not.toBeInTheDocument();
  });

  it("shows no preselect when the instance has no default venue", async () => {
    configMock.mockResolvedValue(config({ default_venue_id: null, allow_venue_choice: true }, [venue("v1", "Smash Arena"), venue("v2", "Green Turf")]));
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText("Choose venue")).toBeInTheDocument();
    });
    const pressed = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(0);
    expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v1");
  });

  it("switching venue moves the booking panel to the new venue", async () => {
    const v1 = venue("v1", "Smash Arena");
    const v2 = venue("v2", "Green Turf");
    configMock.mockResolvedValue(config({ default_venue_id: "v1", allow_venue_choice: true }, [v1, v2]));

    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v1");
    });

    await userEvent.click(screen.getByText("Green Turf"));
    await waitFor(() => {
      expect(screen.getByTestId("book-panel").dataset.venueId).toBe("v2");
    });
    expect(screen.getByText("Green Turf").closest("button")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders the domain denial state for an unauthorized origin", async () => {
    configMock.mockRejectedValue({ code: "WIDGET_DOMAIN_NOT_ALLOWED", message: "nope" });
    wrap(<WidgetEmbed widgetKey="k1" />);
    await waitFor(() => {
      expect(screen.getByText("Widget not authorized here")).toBeInTheDocument();
    });
  });
});
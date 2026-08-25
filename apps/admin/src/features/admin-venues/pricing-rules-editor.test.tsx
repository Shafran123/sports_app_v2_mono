import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PricingRulesEditor } from "./pricing-rules-editor";
import type { VenueHours } from "@myslot/types";

const { listPricingRulesMock, replacePricingRulesMock } = vi.hoisted(() => ({
  listPricingRulesMock: vi.fn(),
  replacePricingRulesMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  business: {
    listPricingRules: listPricingRulesMock,
    replacePricingRules: replacePricingRulesMock
  },
  toApiFailure: (e: unknown) => ({ message: e instanceof Error ? e.message : "Request failed" })
}));

const HOURS: VenueHours[] = Array.from({ length: 7 }, (_, d) => ({
  day_of_week: d,
  open_time: "06:00",
  close_time: "08:00"
}));

const COURTS = [{ id: "c1", name: "Court 1", price_per_slot: 1500, slot_duration_min: 60 }];

function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PricingRulesEditor venueCourts={COURTS} hours={HOURS} />
    </QueryClientProvider>
  );
}

describe("PricingRulesEditor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listPricingRulesMock.mockResolvedValue([]);
    replacePricingRulesMock.mockResolvedValue([]);
  });

  it("paints a slot at the typed price and shows it in the save preview", async () => {
    renderEditor();
    expect(await screen.findByText(/base Rs 1,500/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Price to paint"), { target: { value: "2000" } });
    fireEvent.pointerDown(screen.getByLabelText("Monday 6:00 AM base Rs 1,500"));

    expect(screen.getByLabelText("Monday 6:00 AM Rs 2,000")).toBeInTheDocument();
    expect(screen.getByText("Monday · 6:00 AM – 7:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Rs 2,000 / slot")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save pricing/i }));
    expect(await screen.findByText("Pricing saved.")).toBeInTheDocument();
    expect(replacePricingRulesMock).toHaveBeenCalledWith("c1", [
      { day_of_week: 1, start_time: "06:00", end_time: "07:00", price_per_slot: 2000 }
    ]);
  });

  it("saving an unpainted schedule clears all rules", async () => {
    renderEditor();
    await screen.findByText("Court 1 · 60-min slots · base Rs 1,500");

    fireEvent.click(screen.getByRole("button", { name: "Save pricing" }));
    expect(await screen.findByText("Pricing saved.")).toBeInTheDocument();
    expect(replacePricingRulesMock).toHaveBeenCalledWith("c1", []);
  });

  it("copying a painted day replicates it across the week", async () => {
    renderEditor();
    await screen.findByText("Court 1 · 60-min slots · base Rs 1,500");

    fireEvent.change(screen.getByLabelText("Price to paint"), { target: { value: "1800" } });
    fireEvent.pointerDown(screen.getByLabelText("Monday 6:00 AM base Rs 1,500"));
    fireEvent.click(screen.getByRole("button", { name: /Copy to week/ }));

    fireEvent.click(screen.getByRole("button", { name: "Save pricing" }));
    expect(await screen.findByText("Pricing saved.")).toBeInTheDocument();
    expect(replacePricingRulesMock).toHaveBeenCalledWith(
      "c1",
      Array.from({ length: 7 }, (_, d) => ({
        day_of_week: d,
        start_time: "06:00",
        end_time: "07:00",
        price_per_slot: 1800
      }))
    );
  });
});
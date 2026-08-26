import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomersPage } from "./customers-page";

const customersMock = vi.hoisted(() => vi.fn());

vi.mock("@myslot/api", () => ({
  business: { customers: customersMock },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    status: 0,
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

const rows = [
  {
    id: "c1",
    business_id: "b1",
    email: "pam@abc.test",
    name: "Pam Silva",
    phone: "+94 77 123 4567",
    email_verified_at: "2026-08-01T00:00:00Z",
    phone_verified_at: null,
    joined_at: "2026-08-01T00:00:00Z",
    booking_count: 3,
    total_spend: 5400,
    last_booking_at: "2026-08-20T10:00:00Z"
  },
  {
    id: "c2",
    business_id: "b1",
    email: "kavi@abc.test",
    name: null,
    phone: null,
    email_verified_at: null,
    phone_verified_at: null,
    joined_at: "2026-08-10T00:00:00Z",
    booking_count: 0,
    total_spend: 0,
    last_booking_at: null
  }
];

function wrap(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("CustomersPage (ADR-0030, ticket 05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customersMock.mockResolvedValue(rows);
  });

  it("renders the directory with booking aggregates", async () => {
    wrap(<CustomersPage />);
    expect(await screen.findByText("Pam Silva")).toBeInTheDocument();
    expect(screen.getByText("pam@abc.test · +94 77 123 4567")).toBeInTheDocument();
    expect(screen.getByText("Rs 5,400")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("filters by search and exports a CSV of the filtered set", async () => {
    const urlSpy = vi.fn(() => "blob:csv");
    const revokeSpy = vi.fn();
    URL.createObjectURL = urlSpy;
    URL.revokeObjectURL = revokeSpy;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    wrap(<CustomersPage />);
    await screen.findByText("Pam Silva");

    await userEvent.type(screen.getByLabelText("Search customers"), "kavi");
    expect(screen.queryByText("Pam Silva")).toBeNull();
    expect(screen.getByText("kavi@abc.test")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(clickSpy).toHaveBeenCalled();
    expect(urlSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
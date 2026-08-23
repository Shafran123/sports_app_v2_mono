import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SportsTable } from "./sports-table";

const { listSportsMock } = vi.hoisted(() => ({
  listSportsMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  sports: { list: listSportsMock }
}));

const sports = [
  { id: "s1", slug: "badminton", name: "Badminton", icon: "🏸" },
  { id: "s2", slug: "cricket", name: "Cricket", icon: "🏏" }
];

function renderTable() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SportsTable />
    </QueryClientProvider>
  );
}

describe("SportsTable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listSportsMock.mockResolvedValue(sports);
  });

  it("renders sports rows without invalid table nesting", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderTable();

    expect(await screen.findByText("Badminton")).toBeInTheDocument();
    expect(screen.getByText("Cricket")).toBeInTheDocument();

    const nestingErrors = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("cannot be a child"))
    );
    expect(nestingErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });
});
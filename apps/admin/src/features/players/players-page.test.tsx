import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlayersPage } from "./players-page";

const { listPlayersMock, verifyPlayerMock } = vi.hoisted(() => ({
  listPlayersMock: vi.fn(),
  verifyPlayerMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "admin@spots.lk", role: "admin" },
    loading: false,
    logout: vi.fn()
  })
}));

vi.mock("@myslot/api", () => ({
  admin: { listPlayers: listPlayersMock, verifyPlayer: verifyPlayerMock }
}));

import { admin } from "@myslot/api";
import { PlayersPage } from "./players-page";

const players = [
  {
    id: "p1", name: "Asif Perera", email: "asif@example.com", phone: "+94771234567",
    city: "Colombo", role: "player", phone_verified_at: "2026-08-22T10:00:00.000Z"
  },
  {
    id: "p2", name: "Nimal Silva", email: "nimal@example.com", phone: null,
    city: null, role: "player", phone_verified_at: null
  }
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlayersPage />
    </QueryClientProvider>
  );
}

describe("PlayersPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listPlayersMock.mockResolvedValue(players);
  });

  it("lists players with their verified status", async () => {
    renderPage();

    expect(await screen.findByText("Asif Perera")).toBeInTheDocument();
    expect(screen.getByText("Nimal Silva")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(admin.listPlayers).toHaveBeenCalledWith("");
  });

  it("searches players by term", async () => {
    listPlayersMock.mockResolvedValue([players[1]]);
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText("Search players"), "nimal");
    await waitFor(() => expect(admin.listPlayers).toHaveBeenCalledWith("nimal"));
  });

  it("marks a player verified and refreshes the list", async () => {
    verifyPlayerMock.mockResolvedValue({ ...players[1], phone_verified_at: "2026-08-22T11:00:00.000Z" });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Nimal Silva");
    await user.click(screen.getByRole("button", { name: /Mark verified/ }));

    expect(verifyPlayerMock).toHaveBeenCalledWith("p2");
    await waitFor(() => expect(listPlayersMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Verified")).toBeInTheDocument();
  });
});
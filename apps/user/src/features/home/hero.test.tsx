import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { Hero } from "./hero";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

describe("Hero search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a search icon inside the input", () => {
    render(<Hero />);
    expect(screen.getByRole("textbox", { name: "Search venues, sports or activities" })).toBeInTheDocument();
    expect(document.querySelector(".lucide-search")).toBeInTheDocument();
  });

  it("rotates sport names in the placeholder like a counter", () => {
    render(<Hero />);
    expect(screen.getByText("Search for Badminton")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.getByText("Search for Cricket")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400 * 6);
    });
    expect(screen.getByText("Search for Badminton")).toBeInTheDocument();
  });

  it("hides the rotating placeholder once the user types", () => {
    render(<Hero />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Smash Arena" } });

    expect(screen.queryByText(/Search for/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Smash Arena");
  });
});
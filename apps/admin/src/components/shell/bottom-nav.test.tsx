import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsoleBottomNav } from "./bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/front-desk"
}));

describe("ConsoleBottomNav", () => {
  it("shows the owner tabs", () => {
    render(<ConsoleBottomNav role="venue_owner" />);
    for (const label of ["Dashboard", "Front desk", "Venues", "Calendar", "Plan"]) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", expect.stringContaining("/"));
    }
    expect(screen.getByRole("link", { name: "Front desk" })).toHaveClass("bg-primary-light");
    expect(screen.getByRole("link", { name: "Front desk" })).toHaveClass("text-primary");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveClass("bg-primary-light");
  });

  it("shows the admin tabs", () => {
    render(<ConsoleBottomNav role="admin" />);
    for (const label of ["Dashboard", "Bookings", "Venues", "Leads"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
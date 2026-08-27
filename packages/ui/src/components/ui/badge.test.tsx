import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill, statusLabel } from "./badge";

describe("StatusPill labels", () => {
  it("renders title-case labels for every booking status", () => {
    const cases: Array<[string, string]> = [
      ["pending", "Pending"],
      ["confirmed", "Confirmed"],
      ["completed", "Completed"],
      ["cancelled", "Cancelled"],
      ["cancelled_by_user", "Cancelled by user"],
      ["cancelled_by_owner", "Cancelled by venue"],
      ["cancelled_by_admin", "Cancelled by admin"],
      ["cancelled_auto", "Auto-cancelled"],
      ["no_show", "No-show"]
    ];
    for (const [status, label] of cases) {
      expect(statusLabel(status)).toBe(label);
    }
  });

  it("renders the label text in the pill", () => {
    render(<StatusPill status="cancelled_by_user" />);
    expect(screen.getByText("Cancelled by user")).toBeInTheDocument();
  });

  it("falls back to a humanized title for unknown statuses", () => {
    expect(statusLabel("some_unknown")).toBe("Some Unknown");
  });
});

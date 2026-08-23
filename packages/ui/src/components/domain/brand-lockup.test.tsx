import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLockup } from "./brand-lockup";

describe("BrandLockup", () => {
  it("renders the stem in ink and the TLD suffix in primary", () => {
    render(<BrandLockup brand="MySlot.LK" />);
    expect(screen.getByText("MySlot")).toBeInTheDocument();
    expect(screen.getByText(".LK").className).toContain("text-primary");
  });

  it("renders brands without a dot entirely in ink", () => {
    const { container } = render(<BrandLockup brand="Arena" />);
    expect(screen.getByText("Arena")).toBeInTheDocument();
    expect(container.querySelector(".text-primary")).toBeNull();
  });
});
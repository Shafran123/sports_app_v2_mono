import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("default size carries horizontal padding", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-6");
  });

  it("sm size carries horizontal padding", () => {
    render(<Button size="sm">Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-4");
  });

  it("lg size carries horizontal padding", () => {
    render(<Button size="lg">Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-8");
  });

  it("block size is full width with padding", () => {
    render(<Button size="block">Continue</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("w-full");
    expect(btn).toHaveClass("px-6");
  });
});
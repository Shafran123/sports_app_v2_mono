import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";
import { StatusPill } from "./badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { CountdownPill } from "../domain/countdown-pill";

describe("Button", () => {
  it("renders with children and applies the primary variant", () => {
    render(<Button>Book now</Button>);
    const btn = screen.getByRole("button", { name: "Book now" });
    expect(btn).toHaveClass("bg-primary");
  });

  it("shows a spinner and disables while loading", () => {
    render(<Button loading>Pay</Button>);
    const btn = screen.getByRole("button", { name: "Pay" });
    expect(btn).toBeDisabled();
  });
});

describe("StatusPill", () => {
  it("maps status to a tone and prettifies the label", () => {
    render(<StatusPill status="no_show" />);
    expect(screen.getByText("No-show")).toHaveClass("bg-surface-2");
  });
});

describe("Tabs", () => {
  it("highlights the active tab with a filled pill", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Upcoming</TabsTrigger>
          <TabsTrigger value="b">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Upcoming list</TabsContent>
        <TabsContent value="b">Completed list</TabsContent>
      </Tabs>
    );
    const upcoming = screen.getByRole("tab", { name: "Upcoming" });
    const completed = screen.getByRole("tab", { name: "Completed" });
    expect(upcoming).toHaveAttribute("data-state", "active");
    expect(upcoming.className).toContain("data-[state=active]:bg-primary");
    expect(upcoming.className).toContain("data-[state=active]:text-white");
    await userEvent.click(completed);
    expect(completed).toHaveAttribute("data-state", "active");
    expect(upcoming).toHaveAttribute("data-state", "inactive");
  });

  it("switches content on tab click", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Upcoming</TabsTrigger>
          <TabsTrigger value="b">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Upcoming list</TabsContent>
        <TabsContent value="b">Completed list</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("Upcoming list")).toBeInTheDocument();
    expect(screen.queryByText("Completed list")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(screen.getByText("Completed list")).toBeInTheDocument();
  });
});

describe("CountdownPill", () => {
  it("shows minutes:seconds and flags critical state", () => {
    render(<CountdownPill seconds={90} />);
    expect(screen.getByRole("timer")).toHaveTextContent("1:30");
    render(<CountdownPill seconds={45} />);
    expect(screen.getAllByRole("timer")[1]!).toHaveClass("animate-pulse");
  });
});
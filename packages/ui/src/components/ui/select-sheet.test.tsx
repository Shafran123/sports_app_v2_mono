import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectSheet } from "./select-sheet";

describe("SelectSheet", () => {
  it("renders a native select on desktop", () => {
    render(
      <SelectSheet value="badminton" onChange={() => {}} placeholder="Pick a sport">
        <option value="">All sports</option>
        <option value="badminton">Badminton</option>
      </SelectSheet>
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("badminton");
  });

  it("fires onChange with the option value on the desktop select", async () => {
    let captured = "";
    const onChange = vi.fn((e: React.ChangeEvent<HTMLSelectElement>) => {
      captured = e.target.value;
    });
    render(
      <SelectSheet value="" onChange={onChange} placeholder="Pick">
        <option value="">All</option>
        <option value="badminton">Badminton</option>
      </SelectSheet>
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "badminton");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(captured).toBe("badminton");
  });

  it("opens a bottom sheet on mobile and picks an option", async () => {
    const onChange = vi.fn();
    render(
      <SelectSheet value="" onChange={onChange} placeholder="Pick a venue">
        <option value="">Select a venue</option>
        <option value="v1">Smash Arena</option>
        <option value="v2">Green Turf</option>
      </SelectSheet>
    );
    await userEvent.click(screen.getByRole("button", { name: "Pick a venue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Smash Arena" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: "v1" } }));
  });

  it("marks the currently selected option in the sheet", async () => {
    render(
      <SelectSheet value="v2" onChange={() => {}} placeholder="Pick">
        <option value="v1">Smash Arena</option>
        <option value="v2">Green Turf</option>
      </SelectSheet>
    );
    await userEvent.click(screen.getByRole("button", { name: "Green Turf" }));
    const option = await screen.findByRole("button", { name: "Green Turf" });
    expect(option.className).toContain("bg-primary-light");
  });

  it("scrolls long option lists inside the sheet instead of overlapping the page", async () => {
    const options = Array.from({ length: 40 }, (_, i) => (
      <option key={i} value={`v${i}`}>
        Sport {i}
      </option>
    ));
    render(
      <SelectSheet value="" onChange={() => {}} placeholder="Pick a sport">
        {options}
      </SelectSheet>
    );
    await userEvent.click(screen.getByRole("button", { name: "Pick a sport" }));
    const option = await screen.findByRole("button", { name: "Sport 39" });
    const list = option.parentElement as HTMLElement;
    expect(list.className).toContain("max-h-");
    expect(list.className).toContain("overflow-y-auto");
  });
});

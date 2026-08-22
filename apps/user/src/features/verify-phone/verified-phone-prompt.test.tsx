import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifiedPhonePrompt } from "./verified-phone-prompt";

describe("VerifiedPhonePrompt", () => {
  it("offers to verify now or later", () => {
    render(<VerifiedPhonePrompt onVerify={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Verify now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I'll do it later" })).toBeInTheDocument();
  });

  it("fires the verify action", async () => {
    const onVerify = vi.fn();
    const user = userEvent.setup();
    render(<VerifiedPhonePrompt onVerify={onVerify} />);
    await user.click(screen.getByRole("button", { name: "Verify now" }));
    expect(onVerify).toHaveBeenCalled();
  });

  it("dismisses when the player chooses to do it later", async () => {
    const user = userEvent.setup();
    render(<VerifiedPhonePrompt onVerify={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "I'll do it later" }));
    expect(screen.queryByRole("button", { name: "Verify now" })).not.toBeInTheDocument();
  });
});
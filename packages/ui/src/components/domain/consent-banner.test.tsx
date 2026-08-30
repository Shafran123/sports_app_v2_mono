import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConsentBanner } from "./consent-banner";
import { closeConsentManager, getConsentChoice, openConsentManager, setConsentChoice } from "./consent-store";

describe("ConsentBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    closeConsentManager();
  });

  it("renders blocking on first visit with accept and decline", () => {
    render(<ConsentBanner brandName="MySlot.LK" />);
    const region = screen.getByRole("region", { name: "Analytics consent" });
    expect(within(region).getByText(/MySlot.LK/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept analytics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/privacy");
  });

  it("accept stores the choice and hides the banner", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);
    await user.click(screen.getByRole("button", { name: "Accept analytics" }));
    expect(getConsentChoice()).toBe("accepted");
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();
  });

  it("decline stores the choice and hides the banner", async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);
    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(getConsentChoice()).toBe("rejected");
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();
  });

  it("a returning accepted visitor never sees the banner", () => {
    setConsentChoice("accepted");
    render(<ConsentBanner />);
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();
  });

  it("a returning rejected visitor never sees the banner", () => {
    setConsentChoice("rejected");
    render(<ConsentBanner />);
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();
  });

  it("reopens as a non-blocking manager with a close path", async () => {
    const user = userEvent.setup();
    setConsentChoice("accepted");
    render(<ConsentBanner />);
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();

    act(() => {
      openConsentManager();
    });
    expect(screen.getByRole("region", { name: "Analytics consent" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Analytics consent" })).not.toBeInTheDocument();
    expect(getConsentChoice()).toBe("accepted");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { sendPhoneOtpMock, confirmPhoneOtpMock } = vi.hoisted(() => ({
  sendPhoneOtpMock: vi.fn(),
  confirmPhoneOtpMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@spots/auth", () => ({
  loginWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  sendPhoneOtp: sendPhoneOtpMock,
  confirmPhoneOtp: confirmPhoneOtpMock
}));

import { LoginForm } from "./login-form";

async function openPhoneTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: "Phone OTP" }));
}

describe("LoginForm — phone OTP tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the SMS disclosure line", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await openPhoneTab(user);
    expect(screen.getByText(/Standard SMS rates apply/)).toBeInTheDocument();
  });

  it("rejects a malformed phone number locally without calling Firebase", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await openPhoneTab(user);

    await user.type(screen.getByRole("textbox"), "071 234 5678");
    await user.click(screen.getByRole("button", { name: /Send OTP/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid phone number with country code.");
    expect(sendPhoneOtpMock).not.toHaveBeenCalled();
  });

  it("normalizes a valid phone number before sending", async () => {
    sendPhoneOtpMock.mockResolvedValue({ confirm: vi.fn() });
    const user = userEvent.setup();
    render(<LoginForm />);
    await openPhoneTab(user);

    await user.type(screen.getByRole("textbox"), "+94 71 234 5678");
    await user.click(screen.getByRole("button", { name: /Send OTP/i }));

    expect(sendPhoneOtpMock).toHaveBeenCalledWith("+94712345678");
    expect(screen.getByText(/6-digit code/)).toBeInTheDocument();
  });

  it("toggles the password field between hidden and visible", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
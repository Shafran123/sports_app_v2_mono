import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { sendPhoneOtpMock, confirmPhoneOtpMock, loginWithGoogleMock, meMock, setUserMock, pushMock } = vi.hoisted(() => ({
  sendPhoneOtpMock: vi.fn(),
  confirmPhoneOtpMock: vi.fn(),
  loginWithGoogleMock: vi.fn(),
  meMock: vi.fn(),
  setUserMock: vi.fn(),
  pushMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

vi.mock("@spots/auth", () => ({
  loginWithEmail: vi.fn(),
  loginWithGoogle: loginWithGoogleMock,
  sendPhoneOtp: sendPhoneOtpMock,
  confirmPhoneOtp: confirmPhoneOtpMock
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false, logout: vi.fn(), setUser: setUserMock })
}));

vi.mock("@spots/api", () => ({
  auth: { me: meMock, verifyPhoneSend: vi.fn(), verifyPhoneConfirm: vi.fn() },
  toApiFailure: (e: unknown) => ({ message: (e as Error).message })
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

describe("LoginForm — Google sign-in verify prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginWithGoogleMock.mockResolvedValue(undefined);
  });

  it("offers phone verification after Google sign-in when unverified", async () => {
    meMock.mockResolvedValue({
      id: "u1",
      email: "g@example.com",
      name: "Google User",
      phone: null,
      city: null,
      role: "player",
      phone_verified_at: null
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    const googleButton = screen.getByRole("button", { name: /Continue with Google|Sign in with Google|Google/i });
    await user.click(googleButton);

    expect(await screen.findByText("Verify your phone")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("goes straight to the dashboard when the account already has a verified phone", async () => {
    meMock.mockResolvedValue({
      id: "u1",
      email: "g@example.com",
      name: "Google User",
      phone: "+94771234567",
      city: null,
      role: "player",
      phone_verified_at: "2026-08-22T10:00:00.000Z"
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /Google/i }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });
});
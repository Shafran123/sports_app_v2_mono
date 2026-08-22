import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { registerWithEmailMock, updateMeMock, meMock, setUserMock, loginWithGoogleMock, pushMock } = vi.hoisted(() => ({
  registerWithEmailMock: vi.fn(),
  updateMeMock: vi.fn(),
  meMock: vi.fn(),
  setUserMock: vi.fn(),
  loginWithGoogleMock: vi.fn(),
  pushMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

vi.mock("@spots/auth", () => ({
  registerWithEmail: registerWithEmailMock,
  loginWithGoogle: loginWithGoogleMock
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: null, loading: false, logout: vi.fn(), setUser: setUserMock })
}));

vi.mock("@spots/api", () => ({
  auth: { updateMe: updateMeMock, me: meMock, verifyPhoneSend: vi.fn(), verifyPhoneConfirm: vi.fn() },
  toApiFailure: (e: unknown) => ({ message: (e as Error).message })
}));

import { RegisterForm } from "./register-form";

describe("RegisterForm — persists profile fields on signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerWithEmailMock.mockResolvedValue(undefined);
    meMock.mockResolvedValue({
      id: "u1",
      email: "asif@example.com",
      name: "Asif Perera",
      phone: "+94 71 234 5678",
      city: "Colombo",
      role: "player",
      phone_verified_at: "2026-08-22T10:00:00.000Z"
    });
  });

  it("sends the entered name, phone, and city to the backend on signup", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Full name"), "Asif Perera");
    await user.type(screen.getByLabelText("Email"), "asif@example.com");
    await user.type(screen.getByLabelText("Phone"), "+94 71 234 5678");
    await user.type(screen.getByLabelText("City"), "Colombo");
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(registerWithEmailMock).toHaveBeenCalledWith("asif@example.com", "secret1");
    expect(updateMeMock).toHaveBeenCalled();
    const payload = updateMeMock.mock.calls[0].at(-1);
    expect(payload).toEqual({ name: "Asif Perera", phone: "+94 71 234 5678", city: "Colombo" });
    expect(setUserMock).toHaveBeenCalled();
  });

  it("offers phone verification after Google signup when unverified", async () => {
    loginWithGoogleMock.mockResolvedValue(undefined);
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
    render(<RegisterForm />);

    await user.click(screen.getByRole("button", { name: "Sign up with Google" }));

    expect(await screen.findByText("Verify your phone")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("skips verification and continues when the Google account already has a verified phone", async () => {
    loginWithGoogleMock.mockResolvedValue(undefined);
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
    render(<RegisterForm />);

    await user.click(screen.getByRole("button", { name: "Sign up with Google" }));

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByText("Verify your phone")).not.toBeInTheDocument();
  });
});
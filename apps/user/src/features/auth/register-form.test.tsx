import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

vi.mock("@myslot/auth", () => ({
  registerWithEmail: registerWithEmailMock,
  loginWithGoogle: loginWithGoogleMock
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: null, loading: false, logout: vi.fn(), setUser: setUserMock })
}));

vi.mock("@myslot/api", () => ({
  auth: { updateMe: updateMeMock, me: meMock, verifyPhoneSend: vi.fn(), verifyPhoneConfirm: vi.fn(), verifyEmailSend: vi.fn(), verifyEmailConfirm: vi.fn() },
  featureFlags: { get: vi.fn(async () => ({ phone_verification_required: false, sms_enabled: false, payhere_enabled: false, events_discovery_state: "enabled", brand_name: "MySlot.LK" })) },
  toApiFailure: (e: unknown) => ({ message: (e as Error).message })
}));

import { RegisterForm } from "./register-form";

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RegisterForm />
    </QueryClientProvider>
  );
}

describe("RegisterForm — email + Google sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerWithEmailMock.mockResolvedValue(undefined);
    meMock.mockResolvedValue({
      id: "u1",
      email: "asif@example.com",
      name: "Asif Perera",
      city: "Colombo",
      role: "player",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:00:00.000Z"
    });
  });

  it("sends the entered name and city (no phone) on signup", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Full name"), "Asif Perera");
    await user.type(screen.getByLabelText("Email"), "asif@example.com");
    await user.type(screen.getByLabelText("City (optional)"), "Colombo");
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(registerWithEmailMock).toHaveBeenCalledWith("asif@example.com", "secret1");
      expect(updateMeMock).toHaveBeenCalled();
      const payload = updateMeMock.mock.calls[0].at(-1);
      expect(payload).toEqual({ name: "Asif Perera", city: "Colombo" });
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows no phone field", () => {
    renderForm();
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up with google/i })).toBeInTheDocument();
  });
});
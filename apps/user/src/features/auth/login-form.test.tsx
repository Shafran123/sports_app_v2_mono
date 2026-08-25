import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { loginWithEmailMock, sendPasswordResetMock, loginWithGoogleMock, setUserMock, pushMock } = vi.hoisted(() => ({
  loginWithEmailMock: vi.fn(),
  sendPasswordResetMock: vi.fn(),
  loginWithGoogleMock: vi.fn(),
  setUserMock: vi.fn(),
  pushMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

vi.mock("@myslot/auth", () => ({
  loginWithEmail: loginWithEmailMock,
  loginWithGoogle: loginWithGoogleMock,
  sendPasswordReset: sendPasswordResetMock
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: { id: "u1", phone_verified_at: "2026-08-22T10:00:00.000Z", email_verified_at: "2026-08-22T10:00:00.000Z" }, loading: false, logout: vi.fn(), setUser: setUserMock })
}));

vi.mock("@myslot/api", () => ({
  auth: { me: vi.fn() },
  featureFlags: { get: vi.fn(async () => ({ phone_verification_required: false, sms_enabled: false, payhere_enabled: false, events_discovery_state: "enabled", brand_name: "MySlot.LK" })) },
  toApiFailure: (e: unknown) => ({ message: (e as Error).message })
}));

import { LoginForm } from "./login-form";

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginForm />
    </QueryClientProvider>
  );
}

describe("LoginForm — email + Google sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the email form and the Google button, with no tab chrome", () => {
    renderForm();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("renders no tab pill at all — the email form is the only surface", () => {
    renderForm();
    expect(screen.queryByRole("tab", { name: /email/i })).not.toBeInTheDocument();
  });

  it("signs in with email and password", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("you@example.com"), "asif@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(loginWithEmailMock).toHaveBeenCalledWith("asif@example.com", "secret123");
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("sends a password-reset email when requested", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderForm();

    await user.type(screen.getByPlaceholderText("you@example.com"), "asif@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() => {
      expect(sendPasswordResetMock).toHaveBeenCalledWith("asif@example.com");
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  it("shows an error when the email is missing on forgot-password", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter the email you signed up with/i);
    expect(sendPasswordResetMock).not.toHaveBeenCalled();
  });

  it("routes to the dashboard after a Google sign-in", async () => {
    const user = userEvent.setup();
    const meMock = vi.fn(async () => ({
      id: "u1",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:00:00.000Z",
      role: "player"
    }));
    const { auth } = await import("@myslot/api");
    (auth.me as typeof vi.fn).mockImplementation(meMock);
    renderForm();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
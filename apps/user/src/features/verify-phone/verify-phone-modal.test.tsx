import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { sendMock, confirmMock, setUserMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  confirmMock: vi.fn(),
  setUserMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  auth: { verifyPhoneSend: sendMock, verifyPhoneConfirm: confirmMock },
  toApiFailure: (e: { code?: string; message?: string } | Error) => ({
    status: 0,
    code: (e as { code?: string }).code ?? "UNKNOWN",
    message: (e as Error).message
  })
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false, logout: vi.fn(), setUser: setUserMock })
}));

import { VerifyPhoneModal } from "./verify-phone-modal";

const verifiedUser = {
  id: "u1",
  email: "asif@example.com",
  name: "Asif Perera",
  phone: "+94771234567",
  city: null,
  role: "player",
  phone_verified_at: "2026-08-22T10:00:00.000Z"
};

function renderModal(onVerified = vi.fn()) {
  return render(
    <VerifyPhoneModal open onClose={vi.fn()} onVerified={onVerified} />
  );
}

describe("VerifyPhoneModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the code to the phone and switches to the code step", async () => {
    sendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Phone number"), "+94 71 234 5678");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));

    expect(sendMock).toHaveBeenCalledWith("+94 71 234 5678");
    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  });

  it("disables resend during the 60-second cooldown", async () => {
    sendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Phone number"), "+94771234567");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));

    const resend = screen.getByRole("button", { name: /Resend in \d+/ });
    expect(resend).toBeDisabled();
  });

  it("confirms the code, updates the auth context, and reports done", async () => {
    sendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    confirmMock.mockResolvedValue(verifiedUser);
    const onVerified = vi.fn();
    const user = userEvent.setup();
    renderModal(onVerified);

    await user.type(screen.getByLabelText("Phone number"), "+94771234567");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("+94771234567", "123456"));
    expect(setUserMock).toHaveBeenCalledWith(verifiedUser);
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(verifiedUser));
  });

  it("shows a friendly error for a wrong code and stays open", async () => {
    sendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    confirmMock.mockRejectedValue({ code: "OTP_INVALID", message: "That code is not correct." });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Phone number"), "+94771234567");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    await user.type(await screen.findByLabelText("Verification code"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not correct.");
  });

  it("shows the rate-limit error on send and stays on the phone step", async () => {
    sendMock.mockRejectedValue({
      code: "OTP_RATE_LIMITED",
      message: "Too many codes sent to this number. Try again in an hour."
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Phone number"), "+94771234567");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in an hour");
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });
});
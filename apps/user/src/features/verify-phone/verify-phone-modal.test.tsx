import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { sendMock, confirmMock, setUserMock, siteSendMock, siteConfirmMock, ownerSurfaceMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  confirmMock: vi.fn(),
  setUserMock: vi.fn(),
  siteSendMock: vi.fn(),
  siteConfirmMock: vi.fn(),
  ownerSurfaceMock: vi.fn(() => false)
}));

vi.mock("@myslot/api", () => ({
  auth: { verifyPhoneSend: sendMock, verifyPhoneConfirm: confirmMock },
  siteCustomerAuth: { verifyPhoneSend: siteSendMock, verifyPhoneConfirm: siteConfirmMock },
  isOwnerSurface: () => ownerSurfaceMock(),
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
    ownerSurfaceMock.mockReturnValue(false);
  });

  it("uses the Site Customer auth on a live site host instead of the platform flow (ADR-0030)", async () => {
    ownerSurfaceMock.mockReturnValue(true);
    siteSendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    siteConfirmMock.mockResolvedValue({
      id: "sc1",
      email: "pam@site.test",
      name: "Pam",
      phone: "+94771713701",
      city: null,
      role: "player",
      phone_verified_at: "2026-08-26T10:00:00.000Z"
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Phone number"), "+94771713701");
    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    // The platform endpoint is never hit for a Site Customer — that 500'd
    // with a foreign-key violation on verification_otps.user_id.
    expect(siteSendMock).toHaveBeenCalledWith("+94771713701");
    expect(sendMock).not.toHaveBeenCalled();

    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));
    await waitFor(() => expect(siteConfirmMock).toHaveBeenCalledWith("+94771713701", "123456"));
    expect(confirmMock).not.toHaveBeenCalled();
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
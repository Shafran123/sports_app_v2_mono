import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { sendMock, confirmMock, setUserMock, siteSendMock, siteConfirmMock, siteMeMock, ownerSurfaceMock } = vi.hoisted(
  () => ({
    sendMock: vi.fn(),
    confirmMock: vi.fn(),
    setUserMock: vi.fn(),
    siteSendMock: vi.fn(),
    siteConfirmMock: vi.fn(),
    siteMeMock: vi.fn(),
    ownerSurfaceMock: vi.fn(() => false)
  })
);

vi.mock("@myslot/api", () => ({
  auth: { verifyEmailSend: sendMock, verifyEmailConfirm: confirmMock },
  siteCustomerAuth: {
    verifyEmailSend: siteSendMock,
    verifyEmailConfirm: siteConfirmMock,
    me: siteMeMock
  },
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

vi.mock("@myslot/auth", () => ({
  toAppUser: (c: Record<string, unknown>) => ({ ...c, role: "player", city: null })
}));

import { VerifyEmailModal } from "./verify-email-modal";

function renderModal(onVerified = vi.fn()) {
  return render(
    <VerifyEmailModal open initialEmail="pam@site.test" onClose={vi.fn()} onVerified={onVerified} />
  );
}

describe("VerifyEmailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownerSurfaceMock.mockReturnValue(false);
  });

  it("uses the Site Customer auth on a live site host instead of the platform flow (ADR-0030)", async () => {
    ownerSurfaceMock.mockReturnValue(true);
    siteSendMock.mockResolvedValue({ sent: true });
    siteConfirmMock.mockResolvedValue({ confirmed: true });
    siteMeMock.mockResolvedValue({
      id: "sc1",
      email: "pam@site.test",
      name: "Pam",
      phone: null,
      phone_verified_at: null,
      email_verified_at: "2026-08-26T10:00:00.000Z"
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(siteSendMock).toHaveBeenCalledWith("pam@site.test");
    expect(sendMock).not.toHaveBeenCalled();

    await user.type(await screen.findByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));
    await waitFor(() => expect(siteConfirmMock).toHaveBeenCalledWith("pam@site.test", "123456"));
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("uses the platform flow off-site", async () => {
    sendMock.mockResolvedValue({ sent: true, resend_after_seconds: 60 });
    confirmMock.mockResolvedValue({ id: "u1", email: "pam@site.test" });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Send verification code" }));
    expect(sendMock).toHaveBeenCalledWith("pam@site.test");
    expect(siteSendMock).not.toHaveBeenCalled();
  });
});
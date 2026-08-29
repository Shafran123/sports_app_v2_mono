import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const {
  totpEnableMock,
  totpEnableConfirmMock,
  totpDisableMock,
  totpRegenerateMock,
  setUserMock,
  qrToDataURLMock,
  isOwnerSurfaceMock
} = vi.hoisted(() => ({
  totpEnableMock: vi.fn(),
  totpEnableConfirmMock: vi.fn(),
  totpDisableMock: vi.fn(),
  totpRegenerateMock: vi.fn(),
  setUserMock: vi.fn(),
  qrToDataURLMock: vi.fn(async () => "data:image/png;base64,qr"),
  isOwnerSurfaceMock: vi.fn(() => true)
}));

vi.mock("@myslot/api", () => ({
  isOwnerSurface: isOwnerSurfaceMock,
  siteCustomerAuth: {
    totpEnable: totpEnableMock,
    totpEnableConfirm: totpEnableConfirmMock,
    totpDisable: totpDisableMock,
    totpRegenerateBackupCodes: totpRegenerateMock
  },
  toApiFailure: (e: { code?: string; message?: string }) => ({
    code: e?.code ?? "UNKNOWN",
    message: e?.message ?? "err"
  })
}));

vi.mock("@myslot/auth", () => ({
  useAuth: () => ({ setUser: setUserMock })
}));

vi.mock("qrcode", () => ({
  __esModule: true,
  toDataURL: qrToDataURLMock,
  default: { toDataURL: qrToDataURLMock }
}));

import { SecondFactorCard } from "./second-factor-card";

const baseUser = {
  id: "sc-1",
  role: "player" as const,
  email: "pam@site.test",
  name: "Pam",
  phone: null,
  city: null,
  phone_verified_at: null,
  email_verified_at: null
};

function wrap(ui: ReactNode) {
  return render(ui);
}

describe("SecondFactorCard (ticket 09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOwnerSurfaceMock.mockReturnValue(true);
  });

  it("renders nothing off the owner surface (marketplace player has no factor)", () => {
    isOwnerSurfaceMock.mockReturnValue(false);
    const { container } = wrap(<SecondFactorCard user={baseUser} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("enrolls: QR + secret shown, live code enables the factor and backup codes appear once", async () => {
    totpEnableMock.mockResolvedValue({
      secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      otpauth_url: "otpauth://totp/Venue:pam@site.test?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=Venue"
    });
    totpEnableConfirmMock.mockResolvedValue({
      enabled: true,
      backup_codes: ["AAAA-1111", "BBBB-2222", "CCCC-3333", "DDDD-4444", "EEEE-5555", "FFFF-6666", "GGGG-7777", "HHHH-8888", "JJJJ-9999", "KKKK-0000"]
    });
    const onChanged = vi.fn();
    wrap(<SecondFactorCard user={{ ...baseUser, totp_enabled: false }} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /enable two-factor authentication/i }));

    await waitFor(() => {
      expect(totpEnableMock).toHaveBeenCalledTimes(1);
      expect(qrToDataURLMock).toHaveBeenCalledWith(
        "otpauth://totp/Venue:pam@site.test?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=Venue",
        expect.any(Object)
      );
      expect(screen.getByText("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBeInTheDocument();
      expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText("Authenticator code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(totpEnableConfirmMock).toHaveBeenCalledWith("123456");
      expect(screen.getByText(/save these ten backup codes/i)).toBeInTheDocument();
      expect(screen.getByText("AAAA-1111")).toBeInTheDocument();
      expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ totp_enabled: true }));
    });
  });

  it("refuses a wrong code at enrollment with the server's message", async () => {
    totpEnableMock.mockResolvedValue({ secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", otpauth_url: "otpauth://totp/x" });
    totpEnableConfirmMock.mockRejectedValue({ code: "TOTP_INVALID", message: "That code is not correct." });
    wrap(<SecondFactorCard user={{ ...baseUser, totp_enabled: false }} onChanged={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /enable two-factor authentication/i }));
    await waitFor(() => expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Authenticator code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("That code is not correct.");
    });
  });

  it("regenerates backup codes (old set dies) and can disable with a live code", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    totpRegenerateMock.mockResolvedValue({
      backup_codes: ["NEW1-AAAA", "NEW2-BBBB", "NEW3-CCCC", "NEW4-DDDD", "NEW5-EEEE", "NEW6-FFFF", "NEW7-GGGG", "NEW8-HHHH", "NEW9-JJJJ", "NEW0-KKKK"]
    });
    totpDisableMock.mockResolvedValue({ disabled: true });
    const onChanged = vi.fn();
    wrap(<SecondFactorCard user={{ ...baseUser, totp_enabled: true }} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: /regenerate backup codes/i }));
    await waitFor(() => {
      expect(totpRegenerateMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("NEW1-AAAA")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /i've saved my backup codes/i }));

    await userEvent.type(screen.getByLabelText("Code to confirm disabling"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /^disable$/i }));

    await waitFor(() => {
      expect(totpDisableMock).toHaveBeenCalledWith("123456");
      expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ totp_enabled: false }));
    });
  });

  it("explains that a venue requiring 2FA cannot be disabled", () => {
    wrap(<SecondFactorCard user={{ ...baseUser, totp_enabled: true, totp_required: true }} onChanged={() => {}} />);
    expect(screen.getByText(/can't be disabled/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^disable$/i })).not.toBeInTheDocument();
  });

  it("warns a customer of a requiring venue before they enable", () => {
    wrap(<SecondFactorCard user={{ ...baseUser, totp_enabled: false, totp_required: true }} onChanged={() => {}} />);
    expect(screen.getByText(/this venue requires two-factor authentication/i)).toBeInTheDocument();
  });
});
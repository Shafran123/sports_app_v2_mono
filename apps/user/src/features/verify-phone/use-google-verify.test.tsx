import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useGoogleVerify } from "./use-google-verify";

const { loginWithGoogleMock, meMock, flagsGetMock, setUserMock, onDoneMock } = vi.hoisted(() => ({
  loginWithGoogleMock: vi.fn(),
  meMock: vi.fn(),
  flagsGetMock: vi.fn(),
  setUserMock: vi.fn(),
  onDoneMock: vi.fn()
}));

vi.mock("@myslot/auth", () => ({ loginWithGoogle: loginWithGoogleMock }));
vi.mock("@myslot/api", () => ({
  auth: { me: meMock },
  featureFlags: { get: flagsGetMock }
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ setUser: setUserMock }) }));

const baseMe = {
  id: "u1",
  email: "player@spots.lk",
  name: "Player",
  role: "player",
  phone: null,
  phone_verified_at: null
};

function Harness() {
  const { login, verifyOpen } = useGoogleVerify(onDoneMock);
  return (
    <div>
      <button onClick={login}>Sign in with Google</button>
      {verifyOpen ? <div data-testid="verify-open" /> : null}
    </div>
  );
}

async function signIn() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: /Sign in with Google/i }));
}

describe("useGoogleVerify — respects the phone_verification_required flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginWithGoogleMock.mockResolvedValue(undefined);
    meMock.mockResolvedValue({ ...baseMe });
    onDoneMock.mockClear();
  });

  it("opens the verify modal for an unverified account when the flag is ON", async () => {
    flagsGetMock.mockResolvedValue({ phone_verification_required: true });
    await signIn();
    await waitFor(() => expect(screen.getByTestId("verify-open")).toBeInTheDocument());
    expect(onDoneMock).not.toHaveBeenCalled();
  });

  it("signs the unverified account straight through when the flag is OFF", async () => {
    flagsGetMock.mockResolvedValue({ phone_verification_required: false });
    await signIn();
    await waitFor(() => expect(onDoneMock).toHaveBeenCalled());
    expect(screen.queryByTestId("verify-open")).toBeNull();
  });

  it("still verifies promptly when the account is already verified", async () => {
    meMock.mockResolvedValue({ ...baseMe, phone_verified_at: "2026-08-22T10:00:00.000Z" });
    await signIn();
    await waitFor(() => expect(onDoneMock).toHaveBeenCalled());
    expect(flagsGetMock).not.toHaveBeenCalled();
  });
});
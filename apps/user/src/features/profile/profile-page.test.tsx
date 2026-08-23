import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { updateMeMock, setUserMock } = vi.hoisted(() => ({
  updateMeMock: vi.fn(),
  setUserMock: vi.fn()
}));

const baseUser = { id: "u1", email: "asif@example.com", role: "player", phone_verified_at: null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: ctxUser, loading: false, logout: vi.fn(), setUser: setUserMock })
}));

vi.mock("@myslot/api", () => ({
  auth: { updateMe: updateMeMock, verifyPhoneSend: vi.fn(), verifyPhoneConfirm: vi.fn() },
  toApiFailure: (e: unknown) => ({ message: (e as Error).message })
}));

import { ProfilePage } from "./profile-page";

let ctxUser: Record<string, unknown> | null;

describe("ProfilePage — edits reflect on the profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctxUser = { ...baseUser, name: "Old Name", phone: null, city: null };
    updateMeMock.mockImplementation(async (_client: unknown, input: Record<string, unknown>) => {
      return { ...ctxUser, ...input, name: (input.name as string) ?? ctxUser!.name };
    });
    setUserMock.mockImplementation((u: Record<string, unknown>) => {
      ctxUser = u;
    });
  });

  it("shows the saved name after navigating away and back", async () => {
    const user = userEvent.setup();
    const first = render(<ProfilePage />);

    const nameInput = first.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(first.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(setUserMock).toHaveBeenCalled());
    expect(updateMeMock).toHaveBeenCalled();

    first.unmount();
    const second = render(<ProfilePage />);
    expect(second.getByLabelText("Name")).toHaveValue("New Name");
  });

  it("shows a Verified badge next to the phone when verified", async () => {
    ctxUser = { ...baseUser, name: "Asif", phone: "+94771234567", phone_verified_at: "2026-08-22T10:00:00.000Z" };
    render(<ProfilePage />);
    expect(await screen.findByText("Verified")).toBeInTheDocument();
  });

  it("offers a Verify-phone action when the user is unverified", async () => {
    render(<ProfilePage />);
    const verify = await screen.findByRole("button", { name: "Verify phone" });
    await userEvent.click(verify);
    expect(await screen.findByText(/you need a verified phone/i)).toBeInTheDocument();
  });

  it("warns that a new number needs re-verification when the phone is edited", async () => {
    render(<ProfilePage />);
    const phone = await screen.findByLabelText("Phone");
    await userEvent.clear(phone);
    await userEvent.type(phone, "+94779999999");
    expect(await screen.findByText(/verify the new number/i)).toBeInTheDocument();
  });
});
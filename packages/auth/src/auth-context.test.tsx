import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { User } from "@myslot/types";

const watchAuthMock = vi.fn();
const meMock = vi.fn();
const logoutFirebaseMock = vi.fn();
const ownerSurfaceMock = vi.fn(() => false);
const siteMeMock = vi.fn();

vi.mock("./firebase", () => ({
  watchAuth: (cb: unknown) => watchAuthMock(cb)
}));
vi.mock("./firebaseAuth", () => ({ logoutFirebase: () => logoutFirebaseMock() }));
vi.mock("@myslot/api", () => ({
  auth: { me: () => meMock() },
  TOKEN_KEY: "spots_token",
  SITE_CUSTOMER_TOKEN_KEY: "site_customer_token",
  isOwnerSurface: () => ownerSurfaceMock(),
  persistSiteToken: () => {},
  siteCustomerAuth: { me: () => siteMeMock() }
}));

import { AuthProvider, useAuth } from "./auth-context";

function Probe() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? `user:${user.email}` : "anon"}</div>;
}

const FB_USER = {
  getIdToken: vi.fn().mockResolvedValue("id-token-abc")
};

const MOCK_USER: User = {
  id: "u1",
  email: "dev@spots.app",
  name: "Dev",
  phone: null,
  city: null,
  role: "player"
};

describe("AuthProvider — token before /auth/me (login race regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    watchAuthMock.mockImplementation((cb) => {
      // simulate firebase emitting a signed-in user
      cb(FB_USER);
      return () => {};
    });
    meMock.mockResolvedValue(MOCK_USER);
  });

  it("persists the token BEFORE calling /auth/me", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(meMock).toHaveBeenCalledTimes(1));

    // me() must have been called, and the token must already be in storage when it ran
    expect(meMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("spots_token")).toBe("id-token-abc");
    expect(await screen.findByText(/user:dev@spots\.app/)).toBeInTheDocument();
  });

  it("resolves the Site Customer session instead of Firebase on a site host", async () => {
    ownerSurfaceMock.mockReturnValue(true);
    window.localStorage.setItem("site_customer_token", "sc-token");
    siteMeMock.mockResolvedValue({
      id: "sc1",
      business_id: "b1",
      email: "pam@site.test",
      name: "Pam",
      phone: "+94771234567",
      email_verified_at: "2026-08-01T00:00:00Z",
      phone_verified_at: null
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(await screen.findByText(/user:pam@site\.test/)).toBeInTheDocument();
    expect(siteMeMock).toHaveBeenCalledTimes(1);
    expect(watchAuthMock).not.toHaveBeenCalled();
    ownerSurfaceMock.mockReturnValue(false);
  });
});
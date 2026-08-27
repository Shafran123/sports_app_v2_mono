import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { SiteAccountPanel } from "./site-account-panel";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() })
}));

let ctxUser: Record<string, unknown> | null = null;
const logoutMock = vi.hoisted(() => vi.fn());
vi.mock("@myslot/auth", () => ({
  useAuth: () => ({ user: ctxUser, loading: false, logout: logoutMock, setUser: vi.fn() })
}));

// The panel reuses the shared sign-in form (WidgetIdentity) — stub it so the
// signed-out modal is observable without pulling in its full dependency graph.
vi.mock("@/features/widget/widget-identity", () => ({
  WidgetIdentity: ({ siteName }: { siteName?: string | null }) => (
    <div data-testid="widget-identity">Sign in form for {siteName}</div>
  )
}));

vi.mock("@myslot/ui", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@myslot/ui")>();
  return {
    ...mod,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children, title }: { children: ReactNode; title?: string }) => (
      <div data-testid="dialog-content">
        {title && <h2>{title}</h2>}
        {children}
      </div>
    )
  };
});

const business = { id: "b1", name: "Demo Business" } as never;

beforeEach(() => {
  push.mockClear();
  logoutMock.mockClear();
});

describe("SiteAccountPanel header account chip", () => {
  it("navigates to /bookings and /profile for a signed-in user instead of opening a modal", async () => {
    ctxUser = {
      id: "c1",
      name: "Asif",
      email: "asif@example.com",
      phone: "+94771234000",
      phone_verified_at: "2026-08-22T10:00:00.000Z",
      email_verified_at: "2026-08-22T10:05:00.000Z"
    };
    render(<SiteAccountPanel business={business} />);

    // A signed-in Site Customer gets a "My bookings" entry so they can reach
    // their bookings (and their QR) after sign-in.
    const bookingsBtn = screen.getByRole("button", { name: "My bookings" });
    await userEvent.click(bookingsBtn);
    expect(push).toHaveBeenCalledWith("/bookings");

    const chip = screen.getByRole("button", { name: "Go to profile" });
    await userEvent.click(chip);
    expect(push).toHaveBeenCalledWith("/profile");
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
  });

  it("keeps the controls compact on mobile (labels hidden behind the icons)", async () => {
    ctxUser = { id: "c1", name: "Asif", email: "asif@example.com" };
    render(<SiteAccountPanel business={business} />);

    const bookingsBtn = screen.getByRole("button", { name: "My bookings" });
    const profileBtn = screen.getByRole("button", { name: "Go to profile" });
    // The accessible label (aria) is preserved for screen readers; the visible
    // label span is hidden on mobile (sm:inline) so the header holds the
    // icon-only controls without overflowing.
    expect(bookingsBtn).toHaveAttribute("aria-label", "My bookings");
    expect(profileBtn).toHaveAttribute("aria-label", "Go to profile");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("signs out a signed-in user via the context logout", async () => {
    ctxUser = { id: "c1", name: "Asif", email: "asif@example.com" };
    render(<SiteAccountPanel business={business} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logoutMock).toHaveBeenCalled();
  });

  it("opens the shared WidgetIdentity sign-in form for a signed-out guest", async () => {
    ctxUser = null;
    render(<SiteAccountPanel business={business} />);

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("widget-identity")).toHaveTextContent("Demo Business");
  });
});
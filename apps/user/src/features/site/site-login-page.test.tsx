import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SiteLoginPage } from "./site-login-page";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() })
}));

vi.mock("@/lib/site-host", () => ({
  currentHostname: () => "mysite.localhost"
}));

const identityProps = vi.hoisted(() => vi.fn());
vi.mock("@/features/widget/widget-identity", () => ({
  WidgetIdentity: (props: { siteName?: string | null }) => {
    identityProps(props);
    return <div data-testid="widget-identity">Sign in form for {props.siteName}</div>;
  }
}));

// Stub the chrome — the page's job is to host the site form inside it, which
// SiteChrome/SiteAccountPanel already cover elsewhere.
vi.mock("./site-chrome", () => ({
  SiteChrome: ({ children }: { children: ReactNode }) => <div data-testid="site-chrome">{children}</div>
}));

const config = {
  business: { id: "b1", name: "Demo Business", brand: {} },
  venues: []
} as never;

describe("SiteLoginPage", () => {
  it("renders the site sign-in form (same WidgetIdentity as the header dialog) inside site chrome", () => {
    render(<SiteLoginPage config={config} />);

    expect(screen.getByTestId("site-chrome")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to book" })).toBeInTheDocument();
    expect(screen.getByText(/sign in or create an account to book/i)).toBeInTheDocument();
    expect(screen.getByTestId("widget-identity")).toHaveTextContent("Demo Business");
    expect(identityProps).toHaveBeenCalledWith(
      expect.objectContaining({ siteHostname: "mysite.localhost", siteName: "Demo Business", hideIntro: true })
    );
  });
});
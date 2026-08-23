import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Footer } from "./footer";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>
}));

vi.mock("@myslot/api", () => ({
  featureFlags: {
    get: vi.fn(async () => ({
      phone_verification_required: false,
      sms_enabled: false,
      payhere_enabled: false,
      events_discovery_state: "enabled",
      brand_name: "MySlot.LK"
    }))
  }
}));

function renderFooter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Footer />
    </QueryClientProvider>
  );
}

describe("Footer", () => {
  it("renders the wordmark and copyright from the configured brand", async () => {
    renderFooter();
    await waitFor(() => expect(screen.getByText("MySlot")).toBeInTheDocument());
    expect(screen.getByText(".LK")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} MySlot\\.LK`))).toBeInTheDocument();
  });

  it("falls back to the default brand when the config has none", async () => {
    const { featureFlags } = await import("@myslot/api");
    (featureFlags.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      phone_verification_required: false,
      sms_enabled: false,
      payhere_enabled: false,
      events_discovery_state: "enabled"
    });
    renderFooter();
    await waitFor(() => expect(screen.getByText("MySlot")).toBeInTheDocument());
  });
});
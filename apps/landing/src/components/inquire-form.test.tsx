import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { leadsSubmitMock } = vi.hoisted(() => ({
  leadsSubmitMock: vi.fn()
}));

vi.mock("@myslot/api", () => ({
  leads: { submit: leadsSubmitMock },
  toApiFailure: (e: unknown) => ({
    code: "TEST",
    status: 500,
    message: e instanceof Error ? e.message : "Unexpected error"
  })
}));

import { InquireForm } from "./inquire-form";

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InquireForm />
    </QueryClientProvider>
  );
}

describe("InquireForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not submit when name or email is missing", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /book a demo/i }));

    expect(leadsSubmitMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Book a demo/)).toBeInTheDocument();
  });

  it("submits a lead and shows the success card", async () => {
    leadsSubmitMock.mockResolvedValue({ id: "lead-1" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name *"), "Dev Shah");
    await user.type(screen.getByLabelText("Email *"), "dev@example.com");
    await user.click(screen.getByRole("button", { name: /book a demo/i }));

    expect(leadsSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dev Shah", email: "dev@example.com" })
    );
    expect(await screen.findByText("Thank you — we'll be in touch")).toBeInTheDocument();
  });

  it("shows the API error banner when submission fails", async () => {
    leadsSubmitMock.mockRejectedValue(new Error("Venue name is taken"));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name *"), "Dev Shah");
    await user.type(screen.getByLabelText("Email *"), "dev@example.com");
    await user.click(screen.getByRole("button", { name: /book a demo/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Venue name is taken");
    expect(leadsSubmitMock).toHaveBeenCalledTimes(1);
  });
});
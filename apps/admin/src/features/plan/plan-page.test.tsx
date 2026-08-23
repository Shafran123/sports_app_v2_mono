import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { myPlanMock, acceptMock, declineMock, pdfMock, meMock, setUserMock, openMock } = vi.hoisted(() => ({
  myPlanMock: vi.fn(),
  acceptMock: vi.fn(),
  declineMock: vi.fn(),
  pdfMock: vi.fn(),
  meMock: vi.fn(),
  setUserMock: vi.fn(),
  openMock: vi.fn(() => ({ location: { replace: vi.fn() }, close: vi.fn() }))
}));

const currentUser = { id: "u1", email: "owner@spots.lk", role: "venue_owner", onboarding_state: "pending", must_change_password: false };

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: currentUser, setUser: setUserMock, loading: false, logout: vi.fn() })
}));

vi.mock("@myslot/api", () => ({
  ownerOnboarding: {
    myPlan: myPlanMock,
    acceptAgreement: acceptMock,
    declineAgreement: declineMock,
    agreementPdf: pdfMock
  },
  auth: { me: meMock },
  toApiFailure: (e: unknown) => ({ message: (e as Error)?.message ?? "Unexpected error" })
}));

import { PlanPage } from "./plan-page";

const pendingAgreement = { id: "ag1", title: "MySlot.LK Venue Partner Agreement", body: "You agree to operate your venue(s) in line with MySlot.LK terms.", status: "pending" };
const acceptedAgreement = { ...pendingAgreement, status: "accepted", accepted_at: "2026-08-23T00:00:00Z" };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlanPage />
    </QueryClientProvider>
  );
}

describe("PlanPage — owner agreement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    myPlanMock.mockResolvedValue({ plans: [], agreements: [pendingAgreement], bank_details: {} });
    acceptMock.mockImplementation(async () => {
      myPlanMock.mockResolvedValue({ plans: [], agreements: [acceptedAgreement], bank_details: {} });
      return acceptedAgreement;
    });
    declineMock.mockResolvedValue({ ...pendingAgreement, status: "declined" });
    pdfMock.mockResolvedValue(new Blob(["%PDF-1.4"]));
    meMock.mockResolvedValue({ id: "u1", email: "owner@spots.lk", role: "venue_owner" });
    Object.defineProperty(window, "open", { value: openMock, writable: true, configurable: true });
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(() => "blob:pdf");
  });

  it("clears the pending acceptance card once the agreement is accepted", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Pending your acceptance/);
    expect(screen.getByRole("button", { name: "I accept the agreement" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I accept the agreement" }));

    await waitFor(() => expect(screen.queryByText(/Pending your acceptance/)).toBeNull());
    expect(acceptMock).toHaveBeenCalledWith("ag1");
    expect(screen.queryByRole("button", { name: /I accept the agreement/ })).toBeNull();
  });

  it("does not offer the acceptance card when the latest agreement is already accepted", async () => {
    myPlanMock.mockResolvedValue({ plans: [], agreements: [acceptedAgreement], bank_details: {} });
    renderPage();

    await waitFor(() => expect(screen.queryByText(/Pending your acceptance/)).toBeNull());
    expect(screen.queryByRole("button", { name: /I accept the agreement/ })).toBeNull();
  });

  it("downloads the PDF through the authenticated client instead of a bare link", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Download PDF" });

    expect(screen.queryByRole("link", { name: /PDF/i })).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(pdfMock).toHaveBeenCalledWith("ag1"));
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it("offers a show/hide toggle on both forced password fields", async () => {
    currentUser.must_change_password = true;
    renderPage();
    await screen.findByText(/Set a new password/);

    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
  });
});
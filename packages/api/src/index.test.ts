import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { venues, bookings, events, notifications, auth, business, admin, uploads, featureFlags, ownerOnboarding, leads } from "./index";

function mockClient(handler: (method: string, url: string, opts?: unknown) => unknown): AxiosInstance {
  return {
    get: vi.fn(async (url, opts) => ({ data: handler("get", url, opts) })),
    post: vi.fn(async (url, body) => ({ data: handler("post", url, body) })),
    patch: vi.fn(async (url, body) => ({ data: handler("patch", url, body) })),
    put: vi.fn(async (url, body) => ({ data: handler("put", url, body) }))
  } as unknown as AxiosInstance;
}

const venueRow = {
  id: "v1",
  name: "Smash Arena",
  status: "approved",
  description: null,
  address: "10 Marina Rd",
  city: "Colombo",
  phone: null,
  photos: [],
  amenities: [],
  rules: null,
  cancellation_policy: null,
  min_price: 1500,
  max_price: 2500
};

describe("venues.list", () => {
  it("parses a paginated venue response", async () => {
    const client = mockClient(() => ({
      data: [venueRow],
      meta: { page: 1, limit: 12, total: 1 }
    }));
    const result = await venues.list({ city: "Colombo" }, client);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe("Smash Arena");
    expect(result.meta.total).toBe(1);
  });

  it("passes query params through", async () => {
    const get = vi.fn(async () => ({ data: { data: [], meta: { page: 1, limit: 12, total: 0 } } }));
    const client = { get, post: vi.fn(), patch: vi.fn() } as unknown as AxiosInstance;
    await venues.list({ sport: "badminton", city: "Colombo", page: 2 }, client);
    expect(get).toHaveBeenCalledWith("/venues", { params: { sport: "badminton", city: "Colombo", page: 2 } });
  });
});

describe("venues.detail", () => {
  it("parses a venue detail with courts", async () => {
    const client = mockClient(() => ({
      ...venueRow,
      courts: [{ id: "c1", name: "Court 1", price_per_slot: 1500, slot_duration_min: 60, is_indoor: true, sport: "Badminton", sport_slug: "badminton" }],
      sports: ["Badminton"],
      hours: [{ day_of_week: 1, open_time: "06:00", close_time: "23:00" }]
    }));
    const detail = await venues.detail("v1", client);
    expect(detail.courts).toHaveLength(1);
  });
});

describe("bookings.checkout", () => {
  it("returns a typed checkout result", async () => {
    const client = mockClient(() => ({
      hold_id: "h1",
      idempotency_key: "ik",
      amount: 1500,
      currency: "LKR",
      expires_at: "2026-08-21T06:10:00+05:30",
      payment_params: { hash: "abc" }
    }));
    const result = await bookings.checkout(
      { court_id: "c1", start_at: "x", end_at: "y", idempotency_key: "ik" },
      client
    );
    expect(result.currency).toBe("LKR");
    expect(result.amount).toBe(1500);
  });

  it("sends idempotency_key in the checkout body", async () => {
    const post = vi.fn(async () => ({
      data: {
        hold_id: "h1",
        idempotency_key: "ik-1",
        amount: 1500,
        currency: "LKR",
        expires_at: "2026-08-21T06:10:00+05:30",
        payment_params: { hash: "abc" }
      }
    }));
    const client = { get: vi.fn(), post, patch: vi.fn() } as unknown as AxiosInstance;
    await bookings.checkout(
      { court_id: "c1", start_at: "x", end_at: "y", idempotency_key: "ik-1" },
      client
    );
    expect(post).toHaveBeenCalledWith("/bookings/checkout", {
      court_id: "c1",
      start_at: "x",
      end_at: "y",
      idempotency_key: "ik-1"
    });
  });

  it("parses a booking from the list", async () => {
    const client = mockClient(() => [
      { id: "b1", court_id: "c1", user_id: "u1", start_at: "x", end_at: "y", price_per_slot: 1500, total_price: 1500, status: "confirmed", court_name: "Court 1", venue_name: "Smash Arena", sport: "Badminton" }
    ]);
    const list = await bookings.list(undefined, client);
    expect(list[0]!.status).toBe("confirmed");
  });

  it("sends payment_method=cash on a cash checkout and parses the booking result", async () => {
    const post = vi.fn(async () => ({
      data: {
        booking: {
          id: "b2", court_id: "c1", user_id: "u1", start_at: "x", end_at: "y",
          price_per_slot: 1500, total_price: 1500, status: "confirmed",
          payment_method: "cash", qr_token: "tok-1"
        },
        amount: 1500,
        currency: "LKR"
      }
    }));
    const client = { get: vi.fn(), post, patch: vi.fn() } as unknown as AxiosInstance;
    const result = await bookings.checkout(
      { court_id: "c1", start_at: "x", end_at: "y", idempotency_key: "ik-2", payment_method: "cash" },
      client
    );
    expect(post).toHaveBeenCalledWith("/bookings/checkout", {
      court_id: "c1", start_at: "x", end_at: "y", idempotency_key: "ik-2", payment_method: "cash"
    });
    expect(result.booking?.status).toBe("confirmed");
    expect(result.booking?.qr_token).toBe("tok-1");
  });

  it("markPaid posts to the business endpoint and parses a payment", async () => {
    const post = vi.fn(async () => ({
      data: { id: "p1", booking_id: "b1", amount: 1500, currency: "LKR", status: "paid", payment_method: "cash" }
    }));
    const client = { get: vi.fn(), post, patch: vi.fn() } as unknown as AxiosInstance;
    const payment = await bookings.markPaid("b1", client);
    expect(post).toHaveBeenCalledWith("/business/bookings/b1/mark-paid");
    expect(payment.status).toBe("paid");
    expect(payment.payment_method).toBe("cash");
  });

  it("qrCheckin posts a token to the business endpoint", async () => {
    const post = vi.fn(async () => ({
      data: { id: "b1", court_id: "c1", user_id: "u1", start_at: "x", end_at: "y", price_per_slot: 1500, total_price: 1500, status: "checked_in" }
    }));
    const client = { get: vi.fn(), post, patch: vi.fn() } as unknown as AxiosInstance;
    const booking = await business.qrCheckin("tok-9", client);
    expect(post).toHaveBeenCalledWith("/business/qr-checkin", { token: "tok-9" });
    expect(booking.status).toBe("checked_in");
  });

  it("admin venue lifecycle calls hit the admin endpoints", async () => {
    const post = vi.fn(async () => ({ data: { ...venueRow, status: "suspended" } }));
    const get = vi.fn(async () => ({ data: [{ action: "suspended", created_at: "t", reason: null }] }));
    const client = { get, post, patch: vi.fn() } as unknown as AxiosInstance;

    const suspended = await admin.suspendVenue("v1", { reason: "test" }, client);
    expect(post).toHaveBeenCalledWith("/admin/venues/v1/suspend", { reason: "test" });
    expect(suspended.status).toBe("suspended");

    const audit = await admin.venueAudit("v1", client);
    expect(get).toHaveBeenCalledWith("/admin/venues/v1/audit");
    expect(audit[0]!.action).toBe("suspended");
  });

  it("venues.update and resubmit hit the owner endpoints", async () => {
    const patch = vi.fn(async () => ({ data: { ...venueRow, status: "changes_requested", accepts_cash: true } }));
    const post = vi.fn(async () => ({ data: { ...venueRow, status: "pending" } }));
    const client = { get: vi.fn(), post, patch } as unknown as AxiosInstance;

    const updated = await venues.update("v1", { accepts_cash: true }, client);
    expect(patch).toHaveBeenCalledWith("/venues/v1", { accepts_cash: true });
    expect(updated.accepts_cash).toBe(true);

    const resubmitted = await venues.resubmit("v1", client);
    expect(post).toHaveBeenCalledWith("/venues/v1/resubmit");
    expect(resubmitted.status).toBe("pending");
  });

  it("venues.mine keeps court_count so owner cards show real numbers", async () => {
    const client = mockClient(() => [{ ...venueRow, court_count: 3, created_at: "2026-01-01" }]);
    const list = await venues.mine(client);
    expect(list[0]!.court_count).toBe(3);
  });

  it("admin.overview parses platform numbers", async () => {
    const get = vi.fn(async () => ({
      data: {
        data: { revenue_today: 1500, bookings_today: 3, total_venues: 5, pending_approvals: 1, date: "2026-08-21" }
      }
    }));
    const client = { get, post: vi.fn(), patch: vi.fn() } as unknown as AxiosInstance;
    const overview = await admin.overview(client);
    expect(get).toHaveBeenCalledWith("/admin/overview");
    expect(overview.revenue_today).toBe(1500);
    expect(overview.total_venues).toBe(5);
    expect(overview.pending_approvals).toBe(1);
  });
});

describe("events.list", () => {
  it("parses events", async () => {
    const client = mockClient(() => [
      { id: "e1", title: "Football 5v5", description: null, start_at: "x", end_at: "y", capacity: 10, price: 4500, city: "Colombo", venue_id: null, status: "active", sport_id: "s1", sport_name: "Football", sport_slug: "football", venue_name: null }
    ]);
    const list = await events.list(undefined, client);
    expect(list[0]!.title).toBe("Football 5v5");
  });
});

describe("uploads.upload", () => {
  it("posts the file and returns a url", async () => {
    const post = vi.fn(async () => ({ data: { url: "/uploads/abc.png" } }));
    const client = { get: vi.fn(), post, patch: vi.fn() } as unknown as AxiosInstance;
    const result = await uploads.upload({ filename: "a.png", data: "abc==" }, client);
    expect(post).toHaveBeenCalledWith("/uploads", { filename: "a.png", data: "abc==" });
    expect(result.url).toBe("/uploads/abc.png");
  });
});

describe("notifications.list", () => {
  it("parses notifications", async () => {
    const client = mockClient(() => [
      { id: "n1", type: "booking", title: "Confirmed", message: "ok", is_read: false, created_at: "x" }
    ]);
    const list = await notifications.list(client);
    expect(list[0]!.is_read).toBe(false);
  });
});

describe("auth.me", () => {
  it("parses the user", async () => {
    const client = mockClient(() => ({ id: "u1", email: "dev@spots.app", name: "A", phone: null, city: null, role: "player", phone_verified_at: null }));
    const user = await auth.me(client);
    expect(user.role).toBe("player");
  });
});

describe("featureFlags", () => {
  it("parses public flags", async () => {
    const client = mockClient(() => ({
      phone_verification_required: false,
      sms_enabled: false,
      payhere_enabled: false,
      events_discovery_state: "coming_soon",
      brand_name: "MySlot.LK"
    }));
    const flags = await featureFlags.get(client);
    expect(flags.events_discovery_state).toBe("coming_soon");
    expect(flags.payhere_enabled).toBe(false);
  });
});

describe("leads.submit", () => {
  it("accepts the 201 response returned by the live public/leads endpoint", async () => {
    // sp_be/controller/leadsController.js `submitLead` returns `{ id, status }`
    // wrapped in `{ success, data }` on 201 — not a full OwnerLead.
    const post = vi.fn(async () => ({ data: { success: true, data: { id: "lead-1", status: "new" } } }));
    const client = { get: vi.fn(), post, patch: vi.fn() } as unknown as AxiosInstance;
    const result = await leads.submit({ name: "A", email: "a@b.com" }, client);
    expect(post).toHaveBeenCalledWith("/public/leads", { name: "A", email: "a@b.com" });
    expect(result.id).toBe("lead-1");
  });
});

describe("admin settings & reports", () => {
  const flagDef = (name: string) => ({ name, type: "boolean", default: false, description: "x", value: false });

  it("parses platform config with flags and tax", async () => {
    const client = mockClient(() => ({
      flags: [flagDef("sms_enabled")],
      tax_rate: 12,
      brand_name: "MySlot.LK"
    }));
    const config = await admin.platformConfig(client);
    expect(config.tax_rate).toBe(12);
    expect(config.flags[0]?.name).toBe("sms_enabled");
  });

  it("writes a config key", async () => {
    const client = mockClient(() => ({ name: "tax_rate", value: 5 }));
    const result = await admin.setConfigKey("tax_rate", 5, client);
    expect(result.value).toBe(5);
  });

  it("parses the audit trail", async () => {
    const client = mockClient(() => [{ id: "a1", key: "sms_enabled", old_value: false, new_value: true, changed_at: "2026-08-22T10:00:00Z", admin_name: "Demo Admin" }]);
    const audit = await admin.configAudit(client);
    expect(audit[0]?.key).toBe("sms_enabled");
    expect(audit[0]?.admin_name).toBe("Demo Admin");
  });

  it("parses reports", async () => {
    const client = mockClient(() => ({
      range: 7,
      series: [{ day: "2026-08-22", bookings: 2, revenue: 1200, tax: 144 }],
      by_sport: [{ slug: "badminton", name: "Badminton", bookings: 2, revenue: 1200 }],
      by_venue: [{ name: "Smash Arena", bookings: 2, revenue: 1200 }],
      payment_split: { online: { bookings: 1, revenue: 600 }, cash: { bookings: 1, revenue: 600 } },
      events: { registrations: 3, revenue: 500 }
    }));
    const reports = await admin.reports(7, client);
    expect(reports.series[0]?.tax).toBe(144);
    expect(reports.payment_split.cash.bookings).toBe(1);
  });
});

describe("ownerOnboarding.agreementPdf", () => {
  it("requests the agreement as a blob over the authenticated client", async () => {
    const get = vi.fn(async () => ({ data: new Blob(["%PDF-1.4"]) }));
    const client = { get, post: vi.fn(), patch: vi.fn() } as unknown as AxiosInstance;
    const blob = await ownerOnboarding.agreementPdf("ag1", client);
    expect(get).toHaveBeenCalledWith("/owner-onboarding/agreements/ag1/pdf", { responseType: "blob" });
    expect(blob).toBeInstanceOf(Blob);
  });
});
import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { venues, bookings, events, notifications, auth } from "./index";

function mockClient(handler: (method: string, url: string, opts?: unknown) => unknown): AxiosInstance {
  return {
    get: vi.fn(async (url, opts) => ({ data: handler("get", url, opts) })),
    post: vi.fn(async (url, body) => ({ data: handler("post", url, body) })),
    patch: vi.fn(async (url, body) => ({ data: handler("patch", url, body) }))
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
    const client = mockClient(() => ({ id: "u1", email: "dev@spots.app", name: "A", phone: null, city: null, role: "player" }));
    const user = await auth.me(client);
    expect(user.role).toBe("player");
  });
});
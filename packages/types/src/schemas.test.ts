import { describe, expect, it } from "vitest";
import {
  AvailabilitySchema,
  BookingSchema,
  CheckoutResultSchema,
  VenueDetailSchema,
  VenueSchema,
  EventSchema,
  SlotState
} from "./index";

describe("VenueSchema", () => {
  const raw = {
    id: "v1",
    name: "Smash Arena",
    status: "approved",
    address: "10 Marina Rd",
    city: "Colombo",
    description: null,
    phone: null,
    photos: [],
    amenities: ["parking"],
    rules: null,
    cancellation_policy: null,
    min_price: 1200,
    max_price: 2500
  };

  it("parses a valid venue", () => {
    expect(VenueSchema.parse(raw).name).toBe("Smash Arena");
  });

  it("accepts absent optional fields", () => {
    const parsed = VenueSchema.parse(raw);
    expect(parsed.description).toBeNull();
    expect(parsed.min_price).toBe(1200);
  });

  it("rejects an unknown status", () => {
    expect(() => VenueSchema.parse({ ...raw, status: "live" })).toThrow();
  });
});

describe("VenueDetailSchema", () => {
  it("parses a venue with courts, sports and hours", () => {
    const detail = VenueDetailSchema.parse({
      id: "v1",
      name: "Smash Arena",
      status: "approved",
      address: "10 Marina Rd",
      city: "Colombo",
      description: null,
      phone: null,
      photos: [],
      amenities: [],
      rules: null,
      cancellation_policy: null,
      courts: [
        {
          id: "c1",
          name: "Court 1",
          price_per_slot: 1500,
          slot_duration_min: 60,
          is_indoor: true,
          sport: "Badminton",
          sport_slug: "badminton"
        }
      ],
      sports: ["Badminton"],
      hours: [{ day_of_week: 1, open_time: "06:00", close_time: "23:00" }]
    });
    expect(detail.courts).toHaveLength(1);
    expect(detail.courts[0]!.price_per_slot).toBe(1500);
    expect(detail.hours[0]!.day_of_week).toBe(1);
  });
});

describe("AvailabilitySchema", () => {
  it("parses slot states", () => {
    const avail = AvailabilitySchema.parse({
      date: "2026-08-21",
      courts: [
        {
          court_id: "c1",
          name: "Court 1",
          sport: "Badminton",
          price_per_slot: 1500,
          slot_duration_min: 60,
          slots: [
            { start_at: "2026-08-21T06:00:00+05:30", end_at: "2026-08-21T07:00:00+05:30", state: "available" },
            { start_at: "2026-08-21T07:00:00+05:30", end_at: "2026-08-21T08:00:00+05:30", state: "booked" },
            { start_at: "2026-08-21T08:00:00+05:30", end_at: "2026-08-21T09:00:00+05:30", state: "held" }
          ]
        }
      ]
    });
    expect(avail.courts[0]!.slots.map((s) => s.state)).toEqual(["available", "booked", "held"]);
  });

  it("rejects an unknown slot state", () => {
    expect(() =>
      AvailabilitySchema.parse({
        date: "2026-08-21",
        courts: [{ court_id: "c1", name: "C", price_per_slot: 1, slot_duration_min: 60, slots: [{ start_at: "x", end_at: "y", state: "open" as unknown as SlotState }] }]
      })
    ).toThrow();
  });
});

describe("BookingSchema", () => {
  it("parses a booking with joined fields", () => {
    const booking = BookingSchema.parse({
      id: "b1",
      court_id: "c1",
      user_id: "u1",
      start_at: "2026-08-21T06:00:00+05:30",
      end_at: "2026-08-21T07:00:00+05:30",
      price_per_slot: 1500,
      total_price: 1500,
      status: "confirmed",
      court_name: "Court 1",
      venue_name: "Smash Arena",
      sport: "Badminton"
    });
    expect(booking.venue_name).toBe("Smash Arena");
    expect(booking.status).toBe("confirmed");
  });

  it("rejects an unknown booking status", () => {
    expect(() =>
      BookingSchema.parse({
        id: "b1",
        court_id: "c1",
        user_id: "u1",
        start_at: "x",
        end_at: "y",
        price_per_slot: 1,
        total_price: 1,
        status: "cancelled_at_venue"
      })
    ).toThrow();
  });
});

describe("CheckoutResultSchema", () => {
  it("parses a checkout result", () => {
    const result = CheckoutResultSchema.parse({
      hold_id: "h1",
      idempotency_key: "ik",
      amount: 1500,
      currency: "LKR",
      expires_at: "2026-08-21T06:10:00+05:30",
      payment_params: { hash: "abc", merchant_id: "m" }
    });
    expect(result.currency).toBe("LKR");
    expect(result.payment_params?.hash).toBe("abc");
  });

  it("parses a cash checkout result (booking, no payment params)", () => {
    const result = CheckoutResultSchema.parse({
      booking: {
        id: "b1", court_id: "c1", user_id: "u1", start_at: "x", end_at: "y",
        price_per_slot: 1500, total_price: 1500, status: "confirmed",
        payment_method: "cash", qr_token: "tok"
      },
      amount: 1500,
      currency: "LKR"
    });
    expect(result.booking?.status).toBe("confirmed");
    expect(result.payment_params).toBeUndefined();
  });
});

describe("EventSchema", () => {
  it("parses an event with sport join", () => {
    const event = EventSchema.parse({
      id: "e1",
      title: "Football 5v5",
      description: null,
      start_at: "2026-08-25T18:00:00+05:30",
      end_at: "2026-08-25T20:00:00+05:30",
      capacity: 10,
      price: 4500,
      city: "Colombo",
      venue_id: null,
      status: "active",
      sport_id: "s1",
      sport_name: "Football",
      sport_slug: "football",
      venue_name: null,
      registrations_count: 7
    });
    expect(event.sport_name).toBe("Football");
    expect(event.registrations_count).toBe(7);
  });
});
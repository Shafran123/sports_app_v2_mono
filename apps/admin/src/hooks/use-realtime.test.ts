import { describe, expect, it } from "vitest";
import { eventToQueryKeys } from "./use-realtime";

describe("eventToQueryKeys", () => {
  it("maps every booking event to the front desk + bookings + calendar queries", () => {
    for (const event of [
      "booking.created",
      "booking.confirmed",
      "booking.checked_in",
      "booking.marked_paid",
      "booking.cancelled",
      "booking.no_show"
    ]) {
      const keys = eventToQueryKeys(event);
      expect(keys).toContainEqual(["front-desk-bookings"]);
      expect(keys).toContainEqual(["admin-bookings"]);
      expect(keys).toContainEqual(["admin-availability"]);
    }
  });

  it("returns nothing for unknown events", () => {
    expect(eventToQueryKeys("booking.wat")).toEqual([]);
  });
});
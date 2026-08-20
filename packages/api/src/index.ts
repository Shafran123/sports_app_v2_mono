import type { AxiosInstance } from "axios";
import { z } from "zod";
import {
  AvailabilitySchema,
  BlockSchema,
  BookingSchema,
  CheckoutResultSchema,
  CourtSchema,
  EventRegisterResultSchema,
  EventSchema,
  NotificationSchema,
  SportSchema,
  UserSchema,
  VenueDetailSchema,
  VenueSchema
} from "@spots/types";
export { TOKEN_KEY } from "./client";
export { toApiFailure, getClient, setClient, createClient, type ApiFailure } from "./client";
export { parseData, parseList, parsePaginated } from "./parse";

import { getClient } from "./client";
import { parseData, parseList, parsePaginated } from "./parse";

interface VenueQuery {
  search?: string;
  sport?: string;
  city?: string;
  min_price?: number | string;
  max_price?: number | string;
  indoor?: 0 | 1;
  page?: number;
  limit?: number;
}

export const venues = {
  async list(client: AxiosInstance = getClient(), query: VenueQuery = {}) {
    const res = await client.get("/venues", { params: query });
    return parsePaginated(VenueSchema, res.data);
  },
  async detail(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/venues/${id}`);
    return parseData(VenueDetailSchema, res.data.data ?? res.data);
  },
  async mine(client: AxiosInstance = getClient()) {
    const res = await client.get("/venues/mine");
    return parseList(VenueSchema, res.data.data ?? res.data);
  },
  async availability(id: string, date: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/venues/${id}/availability`, { params: { date } });
    return parseData(AvailabilitySchema, res.data.data ?? res.data);
  }
};

export const courts = {
  async create(
    client: AxiosInstance = getClient(),
    input: {
      venue_id: string;
      name: string;
      sport: string;
      price_per_slot: number;
      slot_duration_min?: number;
      capacity?: number;
      is_indoor?: boolean;
    }
  ) {
    const res = await client.post("/business/courts", input);
    return parseData(CourtSchema, res.data.data ?? res.data);
  },
  async update(
    client: AxiosInstance = getClient(),
    id: string,
    input: Partial<{
      name: string;
      sport: string;
      price_per_slot: number;
      slot_duration_min: number;
      capacity: number;
      is_indoor: boolean;
      is_active: boolean;
    }>
  ) {
    const res = await client.patch(`/business/courts/${id}`, input);
    return parseData(CourtSchema, res.data.data ?? res.data);
  }
};

export const bookings = {
  async checkout(
    client: AxiosInstance = getClient(),
    input: { court_id: string; start_at: string; end_at: string }
  ) {
    const res = await client.post("/bookings/checkout", input);
    return parseData(CheckoutResultSchema, res.data.data ?? res.data);
  },
  async list(client: AxiosInstance = getClient(), status?: string) {
    const res = await client.get("/bookings", { params: status ? { status } : {} });
    return parseList(BookingSchema, res.data.data ?? res.data);
  },
  async get(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/bookings/${id}`);
    return parseData(BookingSchema, res.data.data ?? res.data);
  },
  async cancel(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/bookings/${id}/cancel`);
    return parseData(BookingSchema, res.data.data ?? res.data);
  }
};

export const events = {
  async list(
    client: AxiosInstance = getClient(),
    query: { city?: string; sport?: string; page?: number; limit?: number } = {}
  ) {
    const res = await client.get("/events", { params: query });
    return parseList(EventSchema, res.data.data ?? res.data);
  },
  async detail(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/events/${id}`);
    return parseData(EventSchema, res.data.data ?? res.data);
  },
  async register(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/events/${id}/register`);
    return parseData(EventRegisterResultSchema, res.data.data ?? res.data);
  },
  async cancel(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/events/${id}/cancel`);
    return res.data;
  },
  async create(
    client: AxiosInstance = getClient(),
    input: {
      title: string;
      description?: string;
      city?: string;
      sport?: string;
      venue_id?: string;
      start_at: string;
      end_at: string;
      capacity: number;
      price: number;
    }
  ) {
    const res = await client.post("/events", input);
    return parseData(EventSchema, res.data.data ?? res.data);
  }
};

export const sports = {
  async list(client: AxiosInstance = getClient()) {
    const res = await client.get("/sports");
    return parseList(SportSchema, res.data.data ?? res.data);
  }
};

export const auth = {
  async me(client: AxiosInstance = getClient()) {
    const res = await client.get("/auth/me");
    return parseData(UserSchema, res.data.data ?? res.data);
  },
  async updateMe(
    client: AxiosInstance = getClient(),
    input: { name?: string; phone?: string; city?: string }
  ) {
    const res = await client.patch("/auth/me", input);
    return parseData(UserSchema, res.data.data ?? res.data);
  }
};

export const notifications = {
  async list(client: AxiosInstance = getClient()) {
    const res = await client.get("/notifications");
    return parseList(NotificationSchema, res.data.data ?? res.data);
  },
  async markRead(id: string, client: AxiosInstance = getClient()) {
    const res = await client.patch(`/notifications/${id}/read`);
    return res.data;
  },
  async markAllRead(client: AxiosInstance = getClient()) {
    const res = await client.patch("/notifications/read-all");
    return res.data;
  }
};

// Domains with sp_be business/admin endpoints (typed, Zod-validated)

const BusinessOverviewResponse = z.object({
  bookings_count: z.number(),
  revenue: z.number(),
  month_revenue: z.number(),
  date: z.string().nullable()
});

export const business = {
  async overview(client: AxiosInstance = getClient(), date?: string) {
    const res = await client.get("/business/overview", { params: date ? { date } : {} });
    return BusinessOverviewResponse.parse(res.data.data ?? res.data);
  },
  async listBookings(client: AxiosInstance = getClient(), params: { date?: string } = {}) {
    const res = await client.get("/business/bookings", { params });
    return parseList(BookingSchema, res.data.data ?? res.data);
  },
  async manualBooking(
    client: AxiosInstance = getClient(),
    input: { court_id: string; start_at: string; end_at: string; player_name?: string; player_phone?: string; amount?: number }
  ) {
    const res = await client.post("/business/bookings/manual", input);
    return parseData(BookingSchema, res.data.data ?? res.data);
  },
  async checkIn(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${bookingId}/check-in`);
    return res.data;
  },
  async markNoShow(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${bookingId}/no-show`);
    return res.data;
  },
  async cancelBooking(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${bookingId}/cancel`);
    return res.data;
  },
  async updateVenueHours(
    venueId: string,
    hours: { day_of_week: number; open_time: string; close_time: string }[],
    client: AxiosInstance = getClient()
  ) {
    const res = await client.put(`/business/venues/${venueId}/hours`, { hours });
    return res.data;
  },
  async createBlock(
    courtId: string,
    input: { start_at: string; end_at: string; reason?: string },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post(`/business/courts/${courtId}/blocks`, input);
    return res.data;
  },
  async listBlocks(courtId: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/business/courts/${courtId}/blocks`);
    return parseList(BlockSchema, res.data.data ?? res.data);
  },
  async deleteBlock(courtId: string, blockId: string, client: AxiosInstance = getClient()) {
    const res = await client.delete(`/business/courts/${courtId}/blocks/${blockId}`);
    return res.data;
  }
};

const PendingVenueSchema = VenueSchema.extend({
  owner_name: z.string().nullable().optional(),
  owner_email: z.string().nullable().optional(),
  courts_count: z.number().optional()
});

export const admin = {
  async pendingVenues(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/venues/pending");
    return parseList(PendingVenueSchema, res.data.data ?? res.data);
  },
  async approveVenue(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/approve`);
    return res.data;
  },
  async rejectVenue(id: string, body: { reason?: string }, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/reject`, body);
    return res.data;
  }
};
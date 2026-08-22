import type { AxiosInstance } from "axios";
import { z } from "zod";
import {
  AdminConfigSchema,
  AdminOverviewSchema,
  AdminReportsSchema,
  AvailabilitySchema,
  BlockSchema,
  BusinessOverviewSchema,
  BookingSchema,
  CheckoutResultSchema,
  CourtSchema,
  EventRegisterResultSchema,
  EventSchema,
  FeatureFlagsSchema,
  FlagAuditSchema,
  MyVenueSchema,
  NotificationSchema,
  PaymentSchema,
  SportSchema,
  UserSchema,
  VenueAuditSchema,
  VenueDetailSchema,
  VenueSchema
} from "@spots/types";
export { TOKEN_KEY } from "./client";
export { toApiFailure, getClient, setClient, createClient, type ApiFailure } from "./client";
export { parseData, parseList, parsePaginated } from "./parse";
export { submitPayHere, PAYHERE_CHECKOUT_URL, type PayHereUserFields } from "./payhere";

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
  async list(query: VenueQuery = {}, client: AxiosInstance = getClient()) {
    const res = await client.get("/venues", { params: query });
    return parsePaginated(VenueSchema, res.data);
  },
  async detail(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/venues/${id}`);
    return parseData(VenueDetailSchema, res.data.data ?? res.data);
  },
  async mine(client: AxiosInstance = getClient()) {
    const res = await client.get("/venues/mine");
    return parseList(MyVenueSchema, res.data.data ?? res.data);
  },
  async create(
    input: {
      name: string;
      description?: string;
      address: string;
      city: string;
      phone?: string;
      lat?: number;
      lng?: number;
      photos?: string[];
      amenities?: string[];
      accepts_cash?: boolean;
      sports: string[];
      courts: Array<{ name: string; sport: string; price_per_slot: number; slot_duration_min?: number; capacity?: number; is_indoor?: boolean }>;
      hours: Array<{ day_of_week: number; open_time: string; close_time: string }>;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/venues", input);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      address: string;
      city: string;
      phone: string;
      photos: string[];
      amenities: string[];
      accepts_cash: boolean;
    }>,
    client: AxiosInstance = getClient()
  ) {
    const res = await client.patch(`/venues/${id}`, input);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async resubmit(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/venues/${id}/resubmit`);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async availability(id: string, date: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/venues/${id}/availability`, { params: { date } });
    return parseData(AvailabilitySchema, res.data.data ?? res.data);
  }
};

export const courts = {
  async create(
    input: {
      venue_id: string;
      name: string;
      sport: string;
      price_per_slot: number;
      slot_duration_min?: number;
      capacity?: number;
      is_indoor?: boolean;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/business/courts", input);
    return parseData(CourtSchema, res.data.data ?? res.data);
  },
  async update(
    id: string,
    input: Partial<{
      name: string;
      sport: string;
      price_per_slot: number;
      slot_duration_min: number;
      capacity: number;
      is_indoor: boolean;
      is_active: boolean;
    }>,
    client: AxiosInstance = getClient()
  ) {
    const res = await client.patch(`/business/courts/${id}`, input);
    return parseData(CourtSchema, res.data.data ?? res.data);
  }
};

export const bookings = {
  async checkout(
    input: {
      court_id: string;
      start_at: string;
      end_at: string;
      idempotency_key: string;
      payment_method?: "online" | "cash";
      player_phone?: string;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/bookings/checkout", input);
    return parseData(CheckoutResultSchema, res.data.data ?? res.data);
  },
  async list(status?: string, client: AxiosInstance = getClient()) {
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
  },
  async markPaid(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${id}/mark-paid`);
    return parseData(PaymentSchema, res.data.data ?? res.data);
  }
};

export const events = {
  async list(
    query: { city?: string; sport?: string; page?: number; limit?: number } = {},
    client: AxiosInstance = getClient()
  ) {
    const res = await client.get("/events", { params: query });
    return parseList(EventSchema, res.data.data ?? res.data).map(normalizeEvent);
  },
  async detail(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/events/${id}`);
    return normalizeEvent(parseData(EventSchema, res.data.data ?? res.data));
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
    input: {
      name: string;
      description?: string;
      city?: string;
      sport?: string;
      venue_id?: string;
      start_at: string;
      end_at?: string;
      capacity: number;
      price: number;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/events", input);
    return normalizeEvent(parseData(EventSchema, res.data.data ?? res.data));
  }
};

/** sp_be persists events as `name`; the UI consumes `title`. Normalize after parse. */
function normalizeEvent<T extends { title?: string; name?: string | null }>(event: T): T & { title: string } {
  return { ...event, title: event.title ?? event.name ?? "Untitled event" } as T & { title: string };
}

export const sports = {
  async list(client: AxiosInstance = getClient()) {
    const res = await client.get("/sports");
    return parseList(SportSchema, res.data.data ?? res.data);
  }
};

// Public, unauthenticated read of platform feature flags — mirrors the
// server's gates (which remain the source of truth).
export const featureFlags = {
  async get(client: AxiosInstance = getClient()) {
    const res = await client.get("/public/feature-flags");
    return parseData(FeatureFlagsSchema, res.data.data ?? res.data);
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
  },
  async verifyPhoneSend(phone: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/auth/verify-phone/send", { phone });
    return res.data.data as { sent: boolean; resend_after_seconds: number };
  },
  async verifyPhoneConfirm(phone: string, code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/auth/verify-phone/confirm", { phone, code });
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

export const business = {
  async overview(date?: string, client: AxiosInstance = getClient()) {
    const res = await client.get("/business/overview", { params: date ? { date } : {} });
    return BusinessOverviewSchema.parse(res.data.data ?? res.data);
  },
  async listBookings(params: { date?: string } = {}, client: AxiosInstance = getClient()) {
    const res = await client.get("/business/bookings", { params });
    return parseList(BookingSchema, res.data.data ?? res.data);
  },
  async manualBooking(
    input: { court_id: string; start_at: string; end_at: string; player_name?: string; player_phone?: string; amount?: number },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/business/bookings/manual", input);
    return parseData(BookingSchema, res.data.data ?? res.data);
  },
  async checkIn(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${bookingId}/check-in`);
    return res.data;
  },
  async qrCheckin(token: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/business/qr-checkin", { token });
    return parseData(BookingSchema, res.data.data ?? res.data);
  },
  async qrLookup(token: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/business/qr-lookup", { token });
    return parseData(BookingSchema, res.data.data ?? res.data);
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

export const uploads = {
  async upload(file: { filename: string; data: string }, client: AxiosInstance = getClient()) {
    const res = await client.post("/uploads", file);
    return z.object({ url: z.string() }).parse(res.data.data ?? res.data);
  }
};

const PendingVenueSchema = VenueSchema.extend({
  owner_name: z.string().nullable().optional(),
  owner_email: z.string().nullable().optional(),
  courts_count: z.number().optional(),
  court_count: z.number().optional(),
  created_at: z.string().optional()
});

export const admin = {
  async listPlayers(search = "", client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/players", { params: search ? { search } : {} });
    return parseList(UserSchema, res.data.data ?? res.data);
  },
  async verifyPlayer(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/players/${id}/verify`);
    return parseData(UserSchema, res.data.data ?? res.data);
  },
  async pendingVenues(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/venues/pending");
    return parseList(PendingVenueSchema, res.data.data ?? res.data);
  },
  async listVenues(status?: string, client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/venues", { params: status ? { status } : {} });
    return parseList(PendingVenueSchema, res.data.data ?? res.data);
  },
  async approveVenue(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/approve`);
    return res.data;
  },
  async rejectVenue(id: string, body: { reason?: string }, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/reject`, body);
    return res.data;
  },
  async suspendVenue(id: string, body: { reason?: string } = {}, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/suspend`, body);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async unsuspendVenue(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/unsuspend`);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async banVenue(id: string, body: { reason?: string } = {}, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/ban`, body);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async archiveVenue(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/venues/${id}/archive`);
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  async overview(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/overview");
    return parseData(AdminOverviewSchema, res.data.data ?? res.data);
  },
  async venueAudit(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/admin/venues/${id}/audit`);
    return parseList(VenueAuditSchema, res.data.data ?? res.data);
  },
  // Platform settings: feature flags, tax rate, audit trail, reports.
  async platformConfig(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/config");
    return parseData(AdminConfigSchema, res.data.data ?? res.data);
  },
  async setConfigKey(key: string, value: unknown, client: AxiosInstance = getClient()) {
    const res = await client.put(`/admin/config/flags/${key}`, { value });
    return (res.data.data ?? res.data) as { name: string; value: unknown };
  },
  async configAudit(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/config/audit");
    return parseList(FlagAuditSchema, res.data.data ?? res.data);
  },
  async reports(range: 7 | 30 | 90 = 7, client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/reports", { params: { range } });
    return parseData(AdminReportsSchema, res.data.data ?? res.data);
  }
};
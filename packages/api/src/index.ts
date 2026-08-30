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
  ClosedDateSchema,
  CourtPricingRuleSchema,
  CourtSchema,
  EventRegisterResultSchema,
  EventSchema,
  FeatureFlagsSchema,
  FlagAuditSchema,
  InvoiceSchema,
  ManualBookingResultSchema,
  MyVenueSchema,
  NotificationSchema,
  NudgeResultSchema,
  OfferSchema,
  OwnerAgreementSchema,
  OwnerAllowanceSchema,
  OwnerCreateResultSchema,
  OwnerLeadSchema,
  OwnerListItemSchema,
  OwnerPlanEnvelopeSchema,
  OwnerPlanSchema,
  OwnerPlanTemplateSchema,
  OwnerRenewResultSchema,
  OwnerReportsSchema,
  PaymentSchema,
  SportSchema,
  UserSchema,
  VenueAuditSchema,
  VenueDetailSchema,
  VenueSchema,
  WidgetConfigSchema,
  WidgetInstanceConfigSchema,
  WidgetInstanceSchema,
  WidgetInstanceExtSchema,
  BusinessInfoSchema,
  BusinessProfileSchema,
  SiteRequestSchema,
  SiteRequestEnvelopeSchema,
  SiteRequestInputSchema,
  SiteConfigSchema,
  SiteSessionSchema,
  SiteAuthResultSchema,
  SiteCustomerSchema,
  SiteCustomerSummarySchema,
  BookingSettingsSchema,
  PaymentMethodsSchema,
  AdminPaymentSummarySchema
} from "@myslot/types";
import type { OwnerAgreement, OwnerPlan, VenueBrand, WidgetInstanceInput, SiteRequestInput } from "@myslot/types";
export { TOKEN_KEY, SITE_CUSTOMER_TOKEN_KEY, SITE_GOOGLE_PENDING_KEY, SITE_TOTP_PENDING_KEY, SITE_AUTH_ERROR_KEY, persistSiteToken, isOwnerSurface } from "./client";
export { toApiFailure, getClient, setClient, createClient, type ApiFailure } from "./client";
export { parseData, parseList, parsePaginated } from "./parse";
export { submitPayHere, startPayHereCheckout, PAYHERE_CHECKOUT_URL, type PayHereUserFields } from "./payhere";

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
  async detail(id: string, siteHostnameOrClient?: string | AxiosInstance, client: AxiosInstance = getClient()) {
    const c = typeof siteHostnameOrClient === "string" ? client : (siteHostnameOrClient ?? client);
    const res = await c.get(`/venues/${id}`, { params: typeof siteHostnameOrClient === "string" ? { site_hostname: siteHostnameOrClient } : {} });
    return parseData(VenueDetailSchema, res.data.data ?? res.data);
  },
  // Branded venue page lookup (myslot.lk/<slug>) — public storefront payload.
  async bySlug(slug: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/venues/by-slug/${slug}`);
    return parseData(WidgetConfigSchema, res.data.data ?? res.data);
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
      venue_tax_rate: number;
      cancel_cutoff_hours: number;
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
      payment_method?: "cash" | "payhere" | "online";
      player_phone?: string;
      widget_instance_key?: string;
      site_hostname?: string;
      // Anti-bot Check (ticket 05): Dedicated Site checkouts carry a
      // reCAPTCHA token; the server rejects low-score bookings.
      captcha_token?: string;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/bookings/checkout", input);
    return parseData(CheckoutResultSchema, res.data.data ?? res.data);
  },
  async list(
    status?: string,
    optsOrClient: { venue_id?: string } | AxiosInstance = {},
    client: AxiosInstance = getClient()
  ) {
    // Backward-compatible: callers may pass the client as the second arg.
    const isClient = typeof (optsOrClient as AxiosInstance).get === "function";
    const opts = isClient ? {} : (optsOrClient as { venue_id?: string });
    const realClient = isClient ? (optsOrClient as AxiosInstance) : client;
    const res = await realClient.get("/bookings", {
      params: {
        status: status || undefined,
        venue_id: opts.venue_id || undefined
      }
    });
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

// Public Booking Widget endpoints (ADR-0028): embed config + the unified
// phone-OTP identity step. Unauthenticated by design — the widget's iframe
// runs before any session exists.
export const widget = {
  async config(
    key: string,
    opts: { origin?: string } = {},
    client: AxiosInstance = getClient()
  ) {
    const res = await client.get(`/public/widget/${key}/config`, {
      params: opts.origin ? { origin: opts.origin } : {}
    });
    return parseData(WidgetInstanceConfigSchema, res.data.data ?? res.data);
  }
};

// Public Dedicated Site resolution (ADR-0029): "is THIS hostname a live site
// and whose is it?" — used by the user app's host-based rendering.
export const site = {
  async config(host: string, client: AxiosInstance = getClient()) {
    const res = await client.get("/public/site/by-hostname", { params: { host } });
    return parseData(SiteConfigSchema, res.data.data ?? res.data);
  }
};

// Site Customer auth (ADR-0030): per-Business identities for Dedicated Sites
// and Booking Widgets — our own auth, never Firebase. Sign-in and registration
// carry an optional Anti-bot Check token (ticket 05); a low-score response is
// an email-OTP escalation (SiteAuthChallenge) the caller completes via
// confirmChallenge before a session exists.
export const siteCustomerAuth = {
  async register(
    input: { site_hostname: string; name: string; email: string; password: string; captcha_token?: string },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/site-auth/register", input);
    return parseData(SiteAuthResultSchema, res.data.data ?? res.data);
  },
  async login(
    input: { site_hostname: string; email: string; password: string; captcha_token?: string },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/site-auth/login", input);
    return parseData(SiteAuthResultSchema, res.data.data ?? res.data);
  },
  async google(
    input: { site_hostname: string; id_token: string },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/site-auth/google", input);
    // Enrolled customers get a Second Factor challenge (kind 'totp') back
    // instead of a session (tickets 07-08).
    return parseData(SiteAuthResultSchema, res.data.data ?? res.data);
  },
  async confirmChallenge(challengeId: string, code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/challenge/confirm", { challenge_id: challengeId, code });
    return parseData(SiteSessionSchema, res.data.data ?? res.data);
  },
  async me(client: AxiosInstance = getClient()) {
    const res = await client.get("/site-auth/me");
    return parseData(SiteCustomerSchema, res.data.data ?? res.data);
  },
  async logout(client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/logout");
    return res.data.data ?? res.data;
  },
  async verifyPhoneSend(phone: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/verify-phone/send", { phone });
    return res.data.data as { sent: boolean };
  },
  async verifyPhoneConfirm(phone: string, code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/verify-phone/confirm", { phone, code });
    return res.data.data as { confirmed: boolean };
  },
  async verifyEmailSend(email: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/verify-email/send", { email });
    return res.data.data as { sent: boolean };
  },
  async verifyEmailConfirm(email: string, code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/verify-email/confirm", { email, code });
    return res.data.data as { confirmed: boolean };
  },
  // Second Factor (tickets 07-09): enrollment lives in the Dedicated Site
  // account panel only; the sign-in challenge itself runs through
  // confirmChallenge (kind 'totp') on every surface.
  async totpEnable(client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/totp/enable");
    return res.data.data as { secret: string; otpauth_url: string };
  },
  async totpEnableConfirm(code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/totp/enable/confirm", { code });
    return res.data.data as { enabled: boolean; backup_codes: string[] };
  },
  async totpDisable(code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/totp/disable", { code });
    return res.data.data as { disabled: boolean };
  },
  async totpRegenerateBackupCodes(client: AxiosInstance = getClient()) {
    const res = await client.post("/site-auth/totp/backup-codes/regenerate");
    return res.data.data as { backup_codes: string[] };
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
  },
  async verifyEmailSend(email: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/auth/verify-email/send", { email });
    return res.data.data as { sent: boolean; resend_after_seconds: number };
  },
  async verifyEmailConfirm(email: string, code: string, client: AxiosInstance = getClient()) {
    const res = await client.post("/auth/verify-email/confirm", { email, code });
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
  async reports(query: { range?: 7 | 30 | 90; venue_id?: string } = {}, client: AxiosInstance = getClient()) {
    const res = await client.get("/business/reports", { params: query });
    return OwnerReportsSchema.parse(res.data.data ?? res.data);
  },
  async listBookings(params: { date?: string; date_from?: string; date_to?: string; status?: string; venue_id?: string; sport?: string; page?: number; limit?: number } = {}, client: AxiosInstance = getClient()) {
    const res = await client.get("/business/bookings", { params });
    return parsePaginated(BookingSchema, res.data);
  },
  async invoices(query: { from?: string; to?: string } = {}, client: AxiosInstance = getClient()) {
    const res = await client.get("/business/invoices", { params: query });
    return parseList(InvoiceSchema, res.data.data ?? res.data);
  },
  async bookingBillPdf(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/bookings/${bookingId}/bill`, { responseType: "blob" });
    return res.data as Blob;
  },
  async manualBooking(
    input: {
      court_id: string;
      start_at: string;
      end_at: string;
      player_name?: string;
      player_phone?: string;
      amount?: number;
      paid_by?: "cash" | "card" | "payment_link";
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/business/bookings/manual", input);
    return parseData(ManualBookingResultSchema, res.data.data ?? res.data);
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
  async confirmBooking(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${bookingId}/confirm`);
    return parseData(BookingSchema, res.data.data ?? res.data);
  },
  async cancelBooking(bookingId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/bookings/${bookingId}/cancel`);
    return res.data;
  },
  async getBookingSettings(client: AxiosInstance = getClient()) {
    const res = await client.get("/business/booking-settings");
    return parseData(BookingSettingsSchema, res.data.data ?? res.data);
  },
  async updateBookingSettings(
    patch: { auto_confirm?: boolean; pending_auto_cancel_hours?: number },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.put("/business/booking-settings", patch);
    return parseData(BookingSettingsSchema, res.data.data ?? res.data);
  },
  // Payments (ADR-0044): toggles + PayHere credentials, owner console.
  async getPaymentMethods(client: AxiosInstance = getClient()) {
    const res = await client.get("/business/payment-methods");
    return parseData(PaymentMethodsSchema, res.data.data ?? res.data);
  },
  async updatePaymentMethods(
    patch: { cash?: boolean; payhere?: boolean },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.put("/business/payment-methods", patch);
    return parseData(PaymentMethodsSchema, res.data.data ?? res.data);
  },
  async savePayhereCredentials(
    input: { merchant_id: string; merchant_secret: string; app_id: string; app_secret: string },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.put("/business/payment-methods/payhere/credentials", input);
    return parseData(PaymentMethodsSchema, res.data.data ?? res.data);
  },
  async removePayhereCredentials(client: AxiosInstance = getClient()) {
    const res = await client.delete("/business/payment-methods/payhere/credentials");
    return parseData(PaymentMethodsSchema, res.data.data ?? res.data);
  },
  async updateVenueHours(
    venueId: string,
    hours: { day_of_week: number; open_time: string; close_time: string }[],
    client: AxiosInstance = getClient()
  ) {
    const res = await client.put(`/business/venues/${venueId}/hours`, { hours });
    return res.data;
  },
  async updateAdvanceDays(venueId: string, advanceDays: number, client: AxiosInstance = getClient()) {
    const res = await client.put(`/business/venues/${venueId}/advance-days`, { advance_days: advanceDays });
    return res.data;
  },
  async listClosedDates(venueId: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/business/venues/${venueId}/closed-dates`);
    return parseList(ClosedDateSchema, res.data.data ?? res.data);
  },
  async addClosedDate(venueId: string, input: { closed_date: string; reason?: string }, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/venues/${venueId}/closed-dates`, input);
    return parseData(ClosedDateSchema, res.data.data ?? res.data);
  },
  async removeClosedDate(venueId: string, closedDate: string, client: AxiosInstance = getClient()) {
    const res = await client.delete(`/business/venues/${venueId}/closed-dates/${closedDate}`);
    return res.data;
  },
  async listPricingRules(courtId: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/business/courts/${courtId}/pricing`);
    return parseList(CourtPricingRuleSchema, res.data.data ?? res.data);
  },
  async addPricingRule(
    courtId: string,
    input: { day_of_week: number | null; start_time: string; end_time: string; price_per_slot: number },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post(`/business/courts/${courtId}/pricing`, input);
    return parseData(CourtPricingRuleSchema, res.data.data ?? res.data);
  },
  async replacePricingRules(
    courtId: string,
    rules: { day_of_week: number | null; start_time: string; end_time: string; price_per_slot: number }[],
    client: AxiosInstance = getClient()
  ) {
    const res = await client.put(`/business/courts/${courtId}/pricing`, { rules });
    return parseList(CourtPricingRuleSchema, res.data.data ?? res.data);
  },
  async deletePricingRule(ruleId: string, client: AxiosInstance = getClient()) {
    const res = await client.delete(`/business/pricing/${ruleId}`);
    return res.data;
  },
  async listOffers(venueId: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/business/venues/${venueId}/offers`);
    return parseList(OfferSchema, res.data.data ?? res.data);
  },
  async createOffer(
    venueId: string,
    input: {
      kind: "venue" | "slot";
      discount_type: "percent" | "flat";
      percent?: number;
      flat_amount?: number;
      start_date?: string;
      end_date?: string;
      scopes?: string[];
      windows?: { day_of_week: number | null; start_time: string; end_time: string }[];
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post(`/business/venues/${venueId}/offers`, input);
    return parseData(OfferSchema, res.data.data ?? res.data);
  },
  async updateOffer(
    offerId: string,
    input: { is_active?: boolean; start_date?: string | null; end_date?: string | null },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.patch(`/business/offers/${offerId}`, input);
    return parseData(OfferSchema, res.data.data ?? res.data);
  },
  async deleteOffer(offerId: string, client: AxiosInstance = getClient()) {
    const res = await client.delete(`/business/offers/${offerId}`);
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
  },
  // Business profile + widget instances (owner self-serve, ADR-0028 v1.5).
  async me(client: AxiosInstance = getClient()) {
    const res = await client.get("/business/me");
    return parseData(BusinessProfileSchema, res.data.data ?? res.data);
  },
  async updateMe(
    input: { name?: string; brand?: Partial<VenueBrand>; require_2fa?: boolean },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.patch("/business/me", input);
    return parseData(BusinessInfoSchema, res.data.data ?? res.data);
  },
  async widgetInstances(client: AxiosInstance = getClient()) {
    const res = await client.get("/business/widget-instances");
    return parseList(WidgetInstanceSchema, res.data.data ?? res.data);
  },
  async widgetInstance(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/business/widget-instances/${id}`);
    return WidgetInstanceExtSchema.parse(res.data.data ?? res.data);
  },
  async createWidgetInstance(
    input: WidgetInstanceInput & { name: string },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/business/widget-instances", input);
    return parseData(WidgetInstanceSchema, res.data.data ?? res.data);
  },
  async updateWidgetInstance(
    id: string,
    input: WidgetInstanceInput,
    client: AxiosInstance = getClient()
  ) {
    const res = await client.patch(`/business/widget-instances/${id}`, input);
    return parseData(WidgetInstanceSchema, res.data.data ?? res.data);
  },
  async deleteWidgetInstance(id: string, client: AxiosInstance = getClient()) {
    const res = await client.delete(`/business/widget-instances/${id}`);
    return res.data;
  },
  // Customers directory (ADR-0030): the Business's Site Customers with
  // booking aggregates; searchable.
  async customers(client: AxiosInstance = getClient()) {
    const res = await client.get("/business/customers");
    return parseList(SiteCustomerSummarySchema, res.data.data ?? res.data);
  },
  // Recovery (ticket 07): the Venue Owner resets one of their OWN Business's
  // customers' Second Factor — also revokes all of that customer's sessions.
  async resetCustomerFactor(customerId: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/business/customers/${customerId}/reset-factor`);
    return res.data.data ?? res.data;
  },
  // Marketplace Listing (ADR-0031): per-venue opt back into the marketplace
  // once the Business's Dedicated Site is live (default off at site-live).
  async setMarketplaceListing(venueId: string, enabled: boolean, client: AxiosInstance = getClient()) {
    const res = await client.patch(`/business/venues/${venueId}/marketplace-listing`, { enabled });
    return res.data.data ?? res.data;
  },
  // Dedicated Site request (ADR-0029): owner's own hostname workflow.
  async siteRequest(client: AxiosInstance = getClient()) {
    const res = await client.get("/business/site-request");
    return parseData(SiteRequestEnvelopeSchema, res.data.data ?? res.data);
  },
  async createSiteRequest(input: SiteRequestInput, client: AxiosInstance = getClient()) {
    const res = await client.post("/business/site-request", input);
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
  },
  async siteDnsAdded(client: AxiosInstance = getClient()) {
    const res = await client.post("/business/site-request/dns-added");
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
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
  // Admin read-only payment summary (ADR-0044, Q29/Q33): per-Business config
  // state + PayHere collection sums, never secrets.
  async paymentSummary(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/payments/summary");
    return parseData(AdminPaymentSummarySchema, res.data.data ?? res.data);
  },
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
  // Public/private switch (ADR-0028): marketplace discoverability only.
  async setVenueVisibility(id: string, visibility: "public" | "private", client: AxiosInstance = getClient()) {
    const res = await client.patch(`/admin/venues/${id}/visibility`, { visibility });
    return parseData(VenueSchema, res.data.data ?? res.data);
  },
  // Booking Allowance month tally (ADR-0028, off-platform billing).
  async ownerAllowance(ownerId: string, month: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/admin/owners/${ownerId}/allowance`, { params: { month } });
    return parseData(OwnerAllowanceSchema, res.data.data ?? res.data);
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
  },
  // Owner onboarding — leads, plans, owners.
  async listLeads(status?: string, client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/leads", { params: status ? { status } : {} });
    return parseList(OwnerLeadSchema, res.data.data ?? res.data);
  },
  async updateLead(id: string, input: { status?: string; admin_notes?: string }, client: AxiosInstance = getClient()) {
    const res = await client.patch(`/admin/leads/${id}`, input);
    return parseData(OwnerLeadSchema, res.data.data ?? res.data);
  },
  async listPlanTemplates(includeArchived = false, client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/owners/plan-templates", { params: includeArchived ? { include_archived: 1 } : {} });
    return parseList(OwnerPlanTemplateSchema, res.data.data ?? res.data);
  },
  async createPlanTemplate(input: { name: string; term_days: number; price_lkr?: number; booking_allowance?: number; overflow_fee_percent?: number }, client: AxiosInstance = getClient()) {
    const res = await client.post("/admin/owners/plan-templates", input);
    return parseData(OwnerPlanTemplateSchema, res.data.data ?? res.data);
  },
  async updatePlanTemplate(id: string, input: { name?: string; term_days?: number; price_lkr?: number; booking_allowance?: number; overflow_fee_percent?: number }, client: AxiosInstance = getClient()) {
    const res = await client.patch(`/admin/owners/plan-templates/${id}`, input);
    return parseData(OwnerPlanTemplateSchema, res.data.data ?? res.data);
  },
  async archivePlanTemplate(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/owners/plan-templates/${id}/archive`);
    return parseData(OwnerPlanTemplateSchema, res.data.data ?? res.data);
  },
  async listOwners(expiringWithin?: number, client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/owners", { params: expiringWithin !== undefined ? { expiring_within: expiringWithin } : {} });
    return parseList(OwnerListItemSchema, res.data.data ?? res.data);
  },
  async createOwner(
    input: {
      name: string;
      email: string;
      phone?: string;
      temporary_password: string;
      plan_template_id?: string;
      plan?: { name: string; term_days: number; price_lkr?: number; booking_allowance?: number; overflow_fee_percent?: number };
      start_date?: string;
      agreement: { title: string; body: string };
      lead_id?: string;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/admin/owners", input);
    return parseData(OwnerCreateResultSchema, res.data.data ?? res.data);
  },
  async renewOwner(
    id: string,
    input: {
      plan_template_id?: string;
      plan?: { name: string; term_days: number; price_lkr?: number; booking_allowance?: number; overflow_fee_percent?: number };
      start_date?: string;
      agreement: { title: string; body: string };
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post(`/admin/owners/${id}/renew`, input);
    return parseData(OwnerRenewResultSchema, res.data.data ?? res.data);
  },
  async nudgeOwner(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/owners/${id}/nudge`);
    return parseData(NudgeResultSchema, res.data.data ?? res.data);
  },
  // Dedicated Site requests queue (ADR-0029): staff run the hostname workflow.
  async siteRequests(client: AxiosInstance = getClient()) {
    const res = await client.get("/admin/sites");
    return parseList(SiteRequestSchema, res.data.data ?? res.data);
  },
  async approveSiteRequest(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/sites/${id}/approve`);
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
  },
  async rejectSiteRequest(id: string, reason: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/sites/${id}/reject`, { reason });
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
  },
  async verifySiteRequest(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/sites/${id}/verify`);
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
  },
  async markSiteLive(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/admin/sites/${id}/mark-live`);
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
  },
  async setSiteChecklist(id: string, key: string, done: boolean, client: AxiosInstance = getClient()) {
    const res = await client.patch(`/admin/sites/${id}/checklist`, { key, done });
    return parseData(SiteRequestSchema, res.data.data ?? res.data);
  }
};

// Public + owner-side onboarding surfaces.
export const leads = {
  async submit(
    input: {
      name: string;
      email: string;
      phone?: string;
      venue_name?: string;
      city?: string;
      message?: string;
      // Anti-bot Check (ticket 06): the owner-lead form carries a reCAPTCHA
      // token; the server rejects low-score submissions.
      captcha_token?: string;
    },
    client: AxiosInstance = getClient()
  ) {
    const res = await client.post("/public/leads", input);
    // sp_be submitLead returns a minimal `{ id, status }` envelope on 201, not
    // the full OwnerLead row (it never echoes back submitted PII).
    return parseData(OwnerLeadSchema.pick({ id: true, status: true }), res.data.data ?? res.data);
  }
};

export const ownerOnboarding = {
  async myPlan(client: AxiosInstance = getClient()) {
    const res = await client.get("/owner-onboarding/plan");
    return parseData(OwnerPlanEnvelopeSchema, res.data.data ?? res.data);
  },
  async currentAgreement(client: AxiosInstance = getClient()) {
    const res = await client.get("/owner-onboarding/agreement/current");
    return parseData(OwnerAgreementSchema, res.data.data ?? res.data);
  },
  async acceptAgreement(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/owner-onboarding/agreements/${id}/accept`);
    return parseData(OwnerAgreementSchema, res.data.data ?? res.data);
  },
  async declineAgreement(id: string, client: AxiosInstance = getClient()) {
    const res = await client.post(`/owner-onboarding/agreements/${id}/decline`);
    return parseData(OwnerAgreementSchema, res.data.data ?? res.data);
  },
  async passwordChanged(client: AxiosInstance = getClient()) {
    const res = await client.post("/owner-onboarding/password-changed");
    return res.data.data as Record<string, unknown>;
  },
  async agreementPdf(id: string, client: AxiosInstance = getClient()) {
    const res = await client.get(`/owner-onboarding/agreements/${id}/pdf`, { responseType: "blob" });
    return res.data as Blob;
  }
};
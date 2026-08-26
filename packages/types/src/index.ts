import { z } from "zod";

/* ---------- Enums ---------- */

export const ROLE = z.enum(["player", "venue_owner", "admin"]);
export type Role = z.infer<typeof ROLE>;

export const BOOKING_STATUS = z.enum([
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
  "failed"
]);
export type BookingStatus = z.infer<typeof BOOKING_STATUS>;

export const SLOT_STATE = z.enum([
  "available",
  "past",
  "outside_window",
  "held",
  "blocked",
  "booked"
]);
export type SlotState = z.infer<typeof SLOT_STATE>;

export const VENUE_STATUS = z.enum([
  "pending",
  "approved",
  "rejected",
  "changes_requested",
  "suspended",
  "banned",
  "archived"
]);
export type VenueStatus = z.infer<typeof VENUE_STATUS>;

/* ---------- Identity ---------- */

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  role: ROLE,
  phone_verified_at: z.string().nullable(),
  email_verified_at: z.string().nullable().optional(),
  onboarding_state: z.enum(["pending", "accepted", "grandfathered"]).optional(),
  must_change_password: z.boolean().optional()
});
export type User = z.infer<typeof UserSchema>;

export const SportSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable().optional()
});
export type Sport = z.infer<typeof SportSchema>;

/* ---------- Venues ---------- */

export const BrandContactSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional()
});
export type BrandContact = z.infer<typeof BrandContactSchema>;

export const BrandSchema = z.object({
  colors: z
    .object({
      primary: z.string().optional(),
      accent: z.string().optional()
    })
    .optional(),
  logo_url: z.string().optional(),
  tagline: z.string().optional(),
  about: z.string().optional(),
  // Site-brand tokens (ADR-0031): hero + headline for the portfolio root,
  // and the contact block mirrored in the footer/footer strip.
  hero_image: z.string().optional(),
  headline: z.string().optional(),
  contact: BrandContactSchema.optional()
});
export type VenueBrand = z.infer<typeof BrandSchema>;

export const VenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: VENUE_STATUS,
  description: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  phone: z.string().nullable(),
  photos: z.array(z.string()),
  amenities: z.array(z.string()),
  rules: z.string().nullable(),
  cancellation_policy: z.string().nullable(),
  min_price: z.number().nullable().optional(),
  max_price: z.number().nullable().optional(),
  accepts_cash: z.boolean().optional(),
  venue_tax_rate: z.number().optional(),
  advance_days: z.number().optional(),
  cancel_cutoff_hours: z.number().optional(),
  sports: z.array(z.string()).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  slug: z.string().nullable().optional(),
  brand: BrandSchema.optional()
});
export type Venue = z.infer<typeof VenueSchema>;

export const CourtSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().nullable().optional(),
  price_per_slot: z.number(),
  slot_duration_min: z.number(),
  is_indoor: z.boolean(),
  sport: z.string().nullable().optional(),
  sport_slug: z.string().nullable().optional(),
  venue_id: z.string().optional(),
  is_active: z.boolean().optional()
});
export type Court = z.infer<typeof CourtSchema>;

export const VenueHoursSchema = z.object({
  day_of_week: z.number(),
  open_time: z.string(),
  close_time: z.string()
});
export type VenueHours = z.infer<typeof VenueHoursSchema>;

/* ---------- Off-platform venues: business + widget instances (ADR-0028) ---------- */

export const BusinessInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: BrandSchema,
  site_hostname: z.string().nullable().optional()
});
export type BusinessInfo = z.infer<typeof BusinessInfoSchema>;

export const BusinessProfileSchema = BusinessInfoSchema.extend({
  venues: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      visibility: z.enum(["public", "private"]),
      slug: z.string().nullable(),
      // Marketplace Listing (ADR-0031): per-venue opt-in, default off once
      // the Business's site is live.
      marketplace_listing: z.boolean().optional()
    })
  )
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

/* ---------- Site Customers (ADR-0030) ---------- */

export const SiteCustomerSchema = z.object({
  id: z.string(),
  business_id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email_verified_at: z.string().nullable(),
  phone_verified_at: z.string().nullable()
});
export type SiteCustomer = z.infer<typeof SiteCustomerSchema>;

export const SiteSessionSchema = z.object({
  customer: SiteCustomerSchema,
  token: z.string(),
  expires_at: z.string()
});
export type SiteSession = z.infer<typeof SiteSessionSchema>;

// Owner Console Customers directory row (ADR-0030): a Site Customer with
// booking aggregates.
export const SiteCustomerSummarySchema = SiteCustomerSchema.extend({
  joined_at: z.string(),
  booking_count: z.number(),
  total_spend: z.number(),
  last_booking_at: z.string().nullable()
});
export type SiteCustomerSummary = z.infer<typeof SiteCustomerSummarySchema>;

/* ---------- Dedicated Sites (ADR-0029) ---------- */

export const SITE_REQUEST_STATUSES = ["requested", "approved", "dns_pending", "verifying", "live", "rejected"] as const;

export const SiteChecklistItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  done: z.boolean()
});
export type SiteChecklistItem = z.infer<typeof SiteChecklistItemSchema>;

export const SiteRequestSchema = z.object({
  id: z.string(),
  business_id: z.string(),
  hostname: z.string(),
  hostname_kind: z.enum(["custom", "subdomain"]),
  status: z.enum(SITE_REQUEST_STATUSES),
  dns_type: z.string().nullable(),
  dns_name: z.string().nullable(),
  dns_value: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  checklist: z.array(SiteChecklistItemSchema),
  created_at: z.string(),
  updated_at: z.string(),
  live_at: z.string().nullable(),
  // admin queue extras
  business_name: z.string().optional(),
  owner_email: z.string().nullable().optional(),
  owner_name: z.string().nullable().optional(),
  venue_count: z.number().optional(),
  display_hostname: z.string().nullable().optional(),
  suggested_subdomain: z.string().nullable().optional()
});
export type SiteRequest = z.infer<typeof SiteRequestSchema>;

export const SiteRequestInputSchema = z.object({
  hostname: z.string(),
  hostname_kind: z.enum(["custom", "subdomain"])
});
export type SiteRequestInput = z.infer<typeof SiteRequestInputSchema>;

// Owner GET /business/site-request: the full request when one exists, or just
// the suggested subdomain when not — both shapes flow through this envelope.
export const SiteRequestEnvelopeSchema = SiteRequestSchema.partial().extend({
  suggested_subdomain: z.string().nullable().optional()
});
export type SiteRequestEnvelope = z.infer<typeof SiteRequestEnvelopeSchema>;

// The public site payload: a live hostname's Business + every approved venue
// (Private Venues included — the site is the Business's own storefront).
export const SiteVenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  photos: z.array(z.string()),
  sports: z.array(z.string()),
  visibility: z.enum(["public", "private"]).optional(),
  // Coordinates fuel the auto Google-Maps link on the site's venue cards
  // (ADR-0031): hidden when unset, never re-entered by the owner.
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  // Cheapest active court price, for the "from" caption on the cards.
  min_price: z.number().nullable().optional()
});
export type SiteVenue = z.infer<typeof SiteVenueSchema>;

export const SiteConfigSchema = z.object({
  business: BusinessInfoSchema,
  venues: z.array(SiteVenueSchema)
});
export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export const WidgetInstanceSchema = z.object({
  id: z.string(),
  business_id: z.string(),
  name: z.string(),
  embed_key: z.string(),
  default_venue_id: z.string().nullable(),
  default_venue_name: z.string().nullable().optional(),
  default_venue_status: z.string().nullable().optional(),
  allow_venue_choice: z.boolean(),
  allowed_domains: z.array(z.string()),
  enabled: z.boolean()
});
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;

export const WidgetInstanceInputSchema = z.object({
  name: z.string().max(60).optional(),
  default_venue_id: z.string().nullable().optional(),
  allow_venue_choice: z.boolean().optional(),
  allowed_domains: z.array(z.string()).max(10).optional(),
  enabled: z.boolean().optional()
});
export type WidgetInstanceInput = z.infer<typeof WidgetInstanceInputSchema>;

export const VenueDetailSchema = VenueSchema.extend({
  courts: z.array(CourtSchema),
  sports: z.array(z.string()),
  hours: z.array(VenueHoursSchema)
});
export type VenueDetail = z.infer<typeof VenueDetailSchema>;

// The branded page payload: a venue's public detail plus its Business (brand
// tokens). No widget internals — this page is per-venue by design.
export const WidgetConfigSchema = VenueDetailSchema.extend({
  slug: z.string().nullable().optional(),
  business: BusinessInfoSchema.optional()
});
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const WidgetVenueSchema = VenueDetailSchema.extend({
  slug: z.string().nullable().optional()
});
export type WidgetVenue = z.infer<typeof WidgetVenueSchema>;

// The embed config: business brand + instance defaults + every eligible venue.
export const WidgetInstanceConfigSchema = z.object({
  business: BusinessInfoSchema,
  instance: z.object({
    id: z.string(),
    name: z.string(),
    default_venue_id: z.string().nullable(),
    allow_venue_choice: z.boolean()
  }),
  venues: z.array(WidgetVenueSchema)
});
export type WidgetInstanceConfig = z.infer<typeof WidgetInstanceConfigSchema>;

// Instance + its eligible venues — the payload for the console editor.
export const WidgetInstanceExtSchema = WidgetInstanceSchema.extend({
  venues: z.array(WidgetVenueSchema)
});
export type WidgetInstanceExt = z.infer<typeof WidgetInstanceExtSchema>;

/* ---------- Availability ---------- */

export const SlotSchema = z.object({
  start_at: z.string(),
  end_at: z.string(),
  state: SLOT_STATE,
  price: z.number().optional(),
  offer_price: z.number().nullable().optional()
});
export type Slot = z.infer<typeof SlotSchema>;

export const CourtAvailabilitySchema = z.object({
  court_id: z.string(),
  name: z.string(),
  sport: z.string().nullable(),
  price_per_slot: z.number(),
  slot_duration_min: z.number(),
  slots: z.array(SlotSchema)
});
export type CourtAvailability = z.infer<typeof CourtAvailabilitySchema>;

export const VenueOfferSchema = z.object({
  discount_type: z.enum(["percent", "flat"]),
  value: z.number()
});
export type VenueOffer = z.infer<typeof VenueOfferSchema>;

export const AvailabilitySchema = z.object({
  date: z.string(),
  advance_days: z.number().optional(),
  venue_offer: VenueOfferSchema.nullable().optional(),
  courts: z.array(CourtAvailabilitySchema)
});
export type Availability = z.infer<typeof AvailabilitySchema>;

/* ---------- Closed dates / pricing rules / offers (owner config) ---------- */

export const ClosedDateSchema = z.object({
  closed_date: z.string(),
  reason: z.string().nullable().optional()
});
export type ClosedDate = z.infer<typeof ClosedDateSchema>;

export const CourtPricingRuleSchema = z.object({
  id: z.string(),
  court_id: z.string().optional(),
  day_of_week: z.number().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  price_per_slot: z.number()
});
export type CourtPricingRule = z.infer<typeof CourtPricingRuleSchema>;

export const OfferSchema = z.object({
  id: z.string(),
  venue_id: z.string().optional(),
  kind: z.enum(["venue", "slot"]),
  discount_type: z.enum(["percent", "flat"]),
  percent: z.number().nullable().optional(),
  flat_amount: z.number().nullable().optional(),
  is_active: z.boolean().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  scopes: z.array(z.string()).optional(),
  windows: z.array(
    z.object({
      day_of_week: z.number().nullable(),
      start_time: z.string(),
      end_time: z.string()
    })
  ).optional(),
  created_at: z.string().nullable().optional()
});
export type Offer = z.infer<typeof OfferSchema>;

/* ---------- Bookings ---------- */

export const BookingSchema = z.object({
  id: z.string(),
  court_id: z.string(),
  user_id: z.string(),
  venue_id: z.string().optional(),
  start_at: z.string(),
  end_at: z.string(),
  price_per_slot: z.number(),
  total_price: z.number(),
  subtotal_amount: z.number().optional(),
  discount_amount: z.number().optional(),
  tax_rate: z.number().optional(),
  tax_amount: z.number().optional(),
  venue_tax_rate: z.number().optional(),
  venue_tax_amount: z.number().optional(),
  status: BOOKING_STATUS,
  payment_method: z.string().nullable().optional(),
  player_name: z.string().nullable().optional(),
  player_phone: z.string().nullable().optional(),
  court_name: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().nullable().optional(),
  venue_city: z.string().nullable().optional(),
  sport: z.string().nullable().optional(),
  qr_token: z.string().nullable().optional(),
  checked_in_at: z.string().nullable().optional(),
  cancelled_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  refund_amount: z.number().nullable().optional(),
  cash_payment_status: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional()
});
export type Booking = z.infer<typeof BookingSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  booking_id: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  payment_method: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional()
});
export type Payment = z.infer<typeof PaymentSchema>;

export const CheckoutResultSchema = z.object({
  hold_id: z.string().optional(),
  idempotency_key: z.string().optional(),
  booking: BookingSchema.optional(),
  amount: z.number(),
  currency: z.string(),
  expires_at: z.string().optional(),
  payment_params: z.record(z.string(), z.unknown()).optional()
});
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>;

export const ManualBookingInputSchema = z.object({
  court_id: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  player_name: z.string().optional(),
  player_phone: z.string().optional(),
  amount: z.number().optional()
});
export type ManualBookingInput = z.infer<typeof ManualBookingInputSchema>;

/* ---------- Events ---------- */

export const EventSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  image_url: z.string().nullable().optional(),
  capacity: z.number().nullable(),
  price: z.number(),
  city: z.string().nullable(),
  venue_id: z.string().nullable(),
  status: z.string(),
  sport_id: z.string().nullable(),
  sport_name: z.string().nullable(),
  sport_slug: z.string().nullable(),
  sport: z.string().nullable().optional(),
  venue_name: z.string().nullable(),
  registrations_count: z.number().optional()
});
export type Event = z.infer<typeof EventSchema>;

export const EventRegisterResultSchema = z.object({
  registration_id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  payment_params: z.record(z.string(), z.unknown()).optional()
});
export type EventRegisterResult = z.infer<typeof EventRegisterResultSchema>;

/* ---------- Notifications ---------- */

export const NotificationSchema = z.object({
  id: z.string(),
  type: z.string().nullable(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
  data: z.record(z.string(), z.unknown()).nullable().optional()
});
export type Notification = z.infer<typeof NotificationSchema>;

/* ---------- Business / Admin ---------- */

export const BusinessOverviewSchema = z.object({
  bookings_count: z.number(),
  revenue: z.number(),
  online_revenue: z.number().optional(),
  cash_revenue: z.number().optional(),
  month_revenue: z.number(),
  date: z.string().nullable()
});
export type BusinessOverview = z.infer<typeof BusinessOverviewSchema>;

export const BlockSchema = z.object({
  id: z.string(),
  court_id: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  reason: z.string().nullable()
});
export type Block = z.infer<typeof BlockSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const VenueAuditSchema = z.object({
  id: z.string().optional(),
  action: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
  actor_name: z.string().nullable().optional(),
  actor_email: z.string().nullable().optional()
});
export type VenueAudit = z.infer<typeof VenueAuditSchema>;

export const MyVenueSchema = VenueSchema.extend({
  court_count: z.number().int().optional(),
  created_at: z.string().optional()
});
export type MyVenue = z.infer<typeof MyVenueSchema>;

/* ---------- Feature flags & platform config ---------- */

export const FeatureFlagDefSchema = z.object({
  name: z.string(),
  type: z.enum(["boolean", "enum"]),
  default: z.unknown(),
  description: z.string(),
  values: z.array(z.string()).optional(),
  value: z.unknown()
});
export type FeatureFlagDef = z.infer<typeof FeatureFlagDefSchema>;

export const FeatureFlagsSchema = z.object({
  phone_verification_required: z.boolean(),
  sms_enabled: z.boolean(),
  payhere_enabled: z.boolean(),
  events_discovery_state: z.enum(["enabled", "coming_soon", "hidden"]),
  brand_name: z.string().optional(),
  app_url: z.string().nullable().optional()
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const AdminConfigSchema = z.object({
  flags: z.array(FeatureFlagDefSchema),
  tax_rate: z.number(),
  brand_name: z.string(),
  bank_details: z.record(z.string(), z.string()).optional(),
  sms_events: z.array(z.string()).nullable().optional()
});
export type AdminConfig = z.infer<typeof AdminConfigSchema>;

export const FlagAuditSchema = z.object({
  id: z.string(),
  key: z.string(),
  old_value: z.unknown().nullable(),
  new_value: z.unknown(),
  changed_at: z.string(),
  admin_name: z.string().nullable().optional(),
  admin_email: z.string().nullable().optional()
});
export type FlagAudit = z.infer<typeof FlagAuditSchema>;

export const AdminReportsSchema = z.object({
  range: z.number(),
  series: z.array(
    z.object({
      day: z.string(),
      bookings: z.number(),
      revenue: z.number(),
      tax: z.number(),
      venue_tax: z.number().optional()
    })
  ),
  by_sport: z.array(
    z.object({
      slug: z.string(),
      name: z.string().nullable(),
      bookings: z.number(),
      revenue: z.number()
    })
  ),
  by_venue: z.array(
    z.object({
      name: z.string(),
      bookings: z.number(),
      revenue: z.number()
    })
  ),
  payment_split: z.object({
    online: z.object({ bookings: z.number(), revenue: z.number() }),
    cash: z.object({ bookings: z.number(), revenue: z.number() })
  }),
  events: z.object({ registrations: z.number(), revenue: z.number() })
});
export type AdminReports = z.infer<typeof AdminReportsSchema>;

export const OwnerReportsSchema = AdminReportsSchema.extend({
  by_venue: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      bookings: z.number(),
      revenue: z.number()
    })
  )
});
export type OwnerReports = z.infer<typeof OwnerReportsSchema>;

/* ---------- Owner onboarding ---------- */

export const OwnerLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  venue_name: z.string().nullable(),
  city: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(["new", "contacted", "converted", "closed"]),
  admin_notes: z.string().nullable().optional(),
  created_at: z.string(),
  is_duplicate: z.boolean().optional()
});
export type OwnerLead = z.infer<typeof OwnerLeadSchema>;

export const OwnerPlanTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  term_days: z.number(),
  price_lkr: z.number(),
  booking_allowance: z.number().optional(),
  overflow_fee_percent: z.number().optional(),
  is_archived: z.boolean(),
  created_at: z.string().optional()
});
export type OwnerPlanTemplate = z.infer<typeof OwnerPlanTemplateSchema>;

export const OwnerPlanSchema = z.object({
  id: z.string(),
  owner_id: z.string().optional(),
  name: z.string(),
  term_days: z.number(),
  price_lkr: z.number(),
  booking_allowance: z.number().optional(),
  overflow_fee_percent: z.number().optional(),
  start_date: z.string(),
  end_date: z.string(),
  created_at: z.string().optional()
});
export type OwnerPlan = z.infer<typeof OwnerPlanSchema>;

export const OwnerAllowanceSchema = z.object({
  owner: z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }),
  plan: z
    .object({
      id: z.string(),
      name: z.string(),
      booking_allowance: z.number(),
      overflow_fee_percent: z.number()
    })
    .nullable(),
  month: z.string(),
  usage: z.number(),
  revenue: z.number(),
  overflow_count: z.number(),
  overflow_revenue: z.number(),
  fee_estimate_lkr: z.number()
});
export type OwnerAllowance = z.infer<typeof OwnerAllowanceSchema>;

export const OwnerAgreementSchema = z.object({
  id: z.string(),
  owner_id: z.string().optional(),
  plan_id: z.string().nullable().optional(),
  title: z.string(),
  body: z.string(),
  status: z.enum(["pending", "accepted", "declined"]),
  accepted_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  plan_name: z.string().nullable().optional(),
  plan_term_days: z.number().nullable().optional(),
  plan_price_lkr: z.number().nullable().optional(),
  plan_start: z.string().nullable().optional(),
  plan_end: z.string().nullable().optional()
});
export type OwnerAgreement = z.infer<typeof OwnerAgreementSchema>;

export const OwnerListItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  onboarding_state: z.enum(["pending", "accepted", "grandfathered"]),
  created_at: z.string(),
  plan_id: z.string().nullable().optional(),
  plan_name: z.string().nullable().optional(),
  plan_term_days: z.number().nullable().optional(),
  plan_price_lkr: z.number().nullable().optional(),
  plan_start: z.string().nullable().optional(),
  plan_end: z.string().nullable().optional(),
  agreement_id: z.string().nullable().optional(),
  agreement_status: z.string().nullable().optional(),
  agreement_accepted_at: z.string().nullable().optional(),
  venue_count: z.number().optional()
});
export type OwnerListItem = z.infer<typeof OwnerListItemSchema>;

export const OwnerPlanEnvelopeSchema = z.object({
  plans: z.array(OwnerPlanSchema),
  agreements: z.array(OwnerAgreementSchema),
  bank_details: z.record(z.string(), z.string()).optional()
});
export type OwnerPlanEnvelope = z.infer<typeof OwnerPlanEnvelopeSchema>;

export const OwnerCreateResultSchema = z.object({
  owner: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    role: ROLE,
    onboarding_state: z.string()
  }),
  plan: OwnerPlanSchema,
  agreement: OwnerAgreementSchema
});
export type OwnerCreateResult = z.infer<typeof OwnerCreateResultSchema>;

export const OwnerRenewResultSchema = z.object({
  plan: OwnerPlanSchema,
  agreement: OwnerAgreementSchema
});
export type OwnerRenewResult = z.infer<typeof OwnerRenewResultSchema>;

export const NudgeResultSchema = z.object({ nudged: z.boolean() });
export type NudgeResult = z.infer<typeof NudgeResultSchema>;

/* ---------- Overviews ---------- */

export const AdminOverviewSchema = z.object({
  revenue_today: z.number(),
  bookings_today: z.number(),
  total_venues: z.number(),
  pending_approvals: z.number(),
  date: z.string().nullable().optional()
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

export const PaginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number()
    })
  });

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number };
};
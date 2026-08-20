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

export const VENUE_STATUS = z.enum(["pending", "approved", "rejected"]);
export type VenueStatus = z.infer<typeof VENUE_STATUS>;

/* ---------- Identity ---------- */

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  role: ROLE
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
  sports: z.array(z.string()).optional()
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

export const VenueDetailSchema = VenueSchema.extend({
  courts: z.array(CourtSchema),
  sports: z.array(z.string()),
  hours: z.array(VenueHoursSchema)
});
export type VenueDetail = z.infer<typeof VenueDetailSchema>;

/* ---------- Availability ---------- */

export const SlotSchema = z.object({
  start_at: z.string(),
  end_at: z.string(),
  state: SLOT_STATE
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

export const AvailabilitySchema = z.object({
  date: z.string(),
  courts: z.array(CourtAvailabilitySchema)
});
export type Availability = z.infer<typeof AvailabilitySchema>;

/* ---------- Bookings ---------- */

export const BookingSchema = z.object({
  id: z.string(),
  court_id: z.string(),
  user_id: z.string(),
  start_at: z.string(),
  end_at: z.string(),
  price_per_slot: z.number(),
  total_price: z.number(),
  status: BOOKING_STATUS,
  payment_method: z.string().nullable().optional(),
  player_name: z.string().nullable().optional(),
  player_phone: z.string().nullable().optional(),
  court_name: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().nullable().optional(),
  venue_city: z.string().nullable().optional(),
  sport: z.string().nullable().optional(),
  qr_token: z.string().nullable().optional()
});
export type Booking = z.infer<typeof BookingSchema>;

export const CheckoutResultSchema = z.object({
  hold_id: z.string(),
  idempotency_key: z.string(),
  amount: z.number(),
  currency: z.literal("LKR"),
  expires_at: z.string(),
  payment_params: z.record(z.string(), z.unknown())
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
import type { AxiosInstance } from "axios";
import { z } from "zod";
import { getClient, parseList } from "@spots/api";
import { CourtSchema, VenueSchema } from "@spots/types";
import type { VenueHours } from "@spots/types";

export const MyVenueSchema = VenueSchema.extend({
  court_count: z.number().int().optional(),
  created_at: z.string().optional()
});
export type MyVenue = z.infer<typeof MyVenueSchema>;

export const OwnerCourtSchema = CourtSchema.extend({
  venue_name: z.string().optional(),
  sport_name: z.string().nullable().optional(),
  created_at: z.string().optional()
});
export type OwnerCourt = z.infer<typeof OwnerCourtSchema>;

export const CreatedVenueSchema = VenueSchema.extend({
  courts: z.array(CourtSchema).optional()
});

export interface CourtInput {
  name: string;
  sport: string;
  price_per_slot: number;
  slot_duration_min?: number;
  capacity?: number;
  is_indoor?: boolean;
}

export interface CreateVenueInput {
  name: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  photos?: string[];
  amenities?: string[];
  sports: string[];
  courts: CourtInput[];
  hours?: VenueHours[];
}

export async function fetchMyVenues(client: AxiosInstance = getClient()): Promise<MyVenue[]> {
  const res = await client.get("/venues/mine");
  return parseList(MyVenueSchema, res.data.data ?? res.data);
}

export async function fetchOwnerCourts(client: AxiosInstance = getClient()): Promise<OwnerCourt[]> {
  const res = await client.get("/business/courts");
  return parseList(OwnerCourtSchema, res.data.data ?? res.data);
}

export async function submitCreateVenue(input: CreateVenueInput, client: AxiosInstance = getClient()) {
  const res = await client.post("/venues", input);
  return CreatedVenueSchema.parse(res.data.data ?? res.data);
}
import { z, type ZodType } from "zod";

/** Parse a response body against a schema; the sp_be envelope is `{ data, meta? }`. */
export function parseData<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

/** Parse `{ data: T, meta }` paginated envelopes. */
export function parsePaginated<T>(itemSchema: ZodType<T>, body: unknown): { data: T[]; meta: { page: number; limit: number; total: number } } {
  const parsed = z
    .object({
      data: z.array(itemSchema),
      meta: z.object({ page: z.number(), limit: z.number(), total: z.number() })
    })
    .parse(body);
  return parsed;
}

/** Parse a bare array response body. */
export function parseList<T>(itemSchema: ZodType<T>, body: unknown): T[] {
  return z.array(itemSchema).parse(body);
}
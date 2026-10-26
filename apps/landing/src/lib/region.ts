import { headers } from "next/headers";
import { defaultCurrency, type Currency } from "./pricing";

/**
 * The visitor's pricing currency, from the country Vercel resolves from their
 * IP (x-vercel-ip-country): LKR in Sri Lanka, USD everywhere else. Unknown
 * (local dev, no header) falls back to USD. Pages using this are dynamic.
 */
export async function visitorCurrency(): Promise<Currency> {
  return defaultCurrency((await headers()).get("x-vercel-ip-country"));
}

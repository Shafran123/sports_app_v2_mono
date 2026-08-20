import type { Role } from "@spots/types";

/** Staff roles that may operate the console app. */
export function isStaff(role: Role | undefined | null): boolean {
  return role === "admin" || role === "venue_owner";
}

/** Platform administrators only. */
export function isAdmin(role: Role | undefined | null): boolean {
  return role === "admin";
}
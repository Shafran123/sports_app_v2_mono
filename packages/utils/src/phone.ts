/**
 * Normalize a user-entered phone number to E.164-ish canonical form
 * (leading `+` followed by digits only), or null when it cannot be made valid.
 * Firebase requires the leading `+`; stripping separators here avoids burning
 * an SMS send on input that would be rejected anyway.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const stripped = input.replace(/[\s\-().]/g, "");
  if (!stripped.startsWith("+")) return null;
  const digits = stripped.slice(1);
  if (!/^\d{7,15}$/.test(digits)) return null;
  return `+${digits}`;
}
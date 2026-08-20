export function formatLkr(n: number | string | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "Rs \u2014";
  const value = Number(n);
  const formatted = value.toLocaleString("en-LK", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `Rs ${formatted}`;
}
/** PayHere checkout endpoints. Prefer the server-provided checkout_url when present. */
export const PAYHERE_CHECKOUT_URL = "https://sandbox.payhere.lk/pay/checkout";

export interface PayHereUserFields {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
}

function splitName(name?: string | null): { first_name: string; last_name: string } {
  const parts = (name ?? "").trim().split(/\s+/);
  const first_name = parts[0] ?? "";
  const last_name = parts.slice(1).join(" ");
  return { first_name, last_name };
}

/** Build a hidden HTML form that auto-submits to PayHere with the server's payment params. */
export function submitPayHere(
  paymentParams: Record<string, unknown>,
  user?: PayHereUserFields | null
): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action =
    typeof paymentParams.checkout_url === "string" && paymentParams.checkout_url
      ? paymentParams.checkout_url
      : PAYHERE_CHECKOUT_URL;
  form.style.display = "none";

  const add = (name: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  };

  Object.entries(paymentParams).forEach(([key, value]) => {
    if (key === "checkout_url") return;
    add(key, value);
  });

  if (user) {
    const { first_name, last_name } = splitName(user.first_name);
    add("first_name", first_name || user.first_name);
    add("last_name", last_name || user.last_name);
    add("email", user.email);
    add("phone", user.phone);
    add("city", user.city);
  }

  document.body.appendChild(form);
  form.submit();
}
const PAYHERE_CHECKOUT_URL = "https://sandbox.payhere.lk/pay/checkout";

export interface PayHereBuyer {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
}

/**
 * Builds a hidden PayHere checkout form from the server-signed payment params
 * and submits it imperatively. Only fills buyer fields the gateway needs that
 * are not already present (never clobbers signed params).
 */
export function submitPayHereForm(payment: Record<string, unknown>, buyer: PayHereBuyer): void {
  const action = typeof payment.checkout_url === "string" ? payment.checkout_url : PAYHERE_CHECKOUT_URL;

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(payment)) {
    if (key === "checkout_url" || value === null || value === undefined) continue;
    fields[key] = String(value);
  }

  const name = (buyer.name ?? "").trim();
  const [firstName = "", ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ");

  if (!("first_name" in fields) && firstName) fields.first_name = firstName;
  if (!("last_name" in fields) && lastName) fields.last_name = lastName;
  if (!("card_holder_name" in fields) && name) fields.card_holder_name = name;
  if (!("email" in fields) && buyer.email) fields.email = buyer.email;
  if (!("phone" in fields) && buyer.phone) fields.phone = buyer.phone;
  if (!("city" in fields) && buyer.city) fields.city = buyer.city;
  if (!("country" in fields)) fields.country = "Sri Lanka";

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";
  form.setAttribute("accept-charset", "UTF-8");

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
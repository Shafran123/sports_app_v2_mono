/** PayHere checkout endpoints. Prefer the server-provided checkout_url when present. */
export const PAYHERE_CHECKOUT_URL = "https://sandbox.payhere.lk/pay/checkout";

// PayHere serves ONE onsite-checkout script, from the live host: startCheckout
// routes to the sandbox itself when its config carries sandbox: true. The
// sandbox host has no /lib/payhere.js (404), so a sandbox-specific script URL
// would silently fall back to the redirect — losing the in-page overlay.
const PAYHERE_SCRIPT = "https://www.payhere.lk/lib/payhere.js";

declare global {
  interface Window {
    PayHere?: { startCheckout: (payment: Record<string, unknown>) => void };
  }
}

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

let payhereScriptPromise: Promise<boolean> | null = null;

// Load PayHere's onsite-checkout script once (single live build serves both
// environments; sandbox routing is a startCheckout config flag). Resolves
// true when window.PayHere.startCheckout is available.
function loadPayHereScript(): Promise<boolean> {
  if (payhereScriptPromise) return payhereScriptPromise;
  payhereScriptPromise = new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.PayHere?.startCheckout) return resolve(true);
    const script = document.createElement("script");
    script.src = PAYHERE_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.PayHere?.startCheckout));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return payhereScriptPromise;
}

/**
 * Onsite Checkout: open PayHere's payment overlay in-page, so the customer
 * never leaves the site to pay. Resolves true when the overlay started;
 * when the script cannot load it falls back to the hidden-form redirect and
 * resolves false. The server's payment_params carry the hash/return_url, so
 * no checkout state is rebuilt client-side.
 */
export async function startPayHereCheckout(
  paymentParams: Record<string, unknown>,
  user?: PayHereUserFields | null
): Promise<boolean> {
  const checkoutUrl =
    typeof paymentParams.checkout_url === "string" && paymentParams.checkout_url
      ? paymentParams.checkout_url
      : PAYHERE_CHECKOUT_URL;
  const sandbox = checkoutUrl.includes("sandbox");
  const loaded = await loadPayHereScript();
  if (!loaded) {
    submitPayHere(paymentParams, user);
    return false;
  }
  const { first_name, last_name } = splitName(user?.first_name);
  window.PayHere?.startCheckout({
    ...paymentParams,
    sandbox,
    first_name: first_name || user?.first_name || "",
    last_name: last_name || user?.last_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    city: user?.city || ""
  });
  return true;
}
// Google reCAPTCHA v3 client helper (Anti-bot Check, tickets 05-06): mints a
// single-use token for a named action. Returns null when the site key is not
// configured (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`) or when executing fails — the
// callers then fail closed server-side anyway (a missing token is rejected by
// the middleware). Only ever runs in the browser; SSR renders nothing.

let scriptPromise: Promise<void> | null = null;

function siteKey(): string | null {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://www.google.com/recaptcha/api.js"]'
    );
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Mint a reCAPTCHA v3 token for `action`, or undefined when unavailable. */
export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const key = siteKey();
  if (!key) return undefined;
  if (!window.grecaptcha) {
    try {
      await loadScript();
    } catch {
      return undefined;
    }
  }
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) return undefined;
  try {
    await new Promise<void>((resolve) => grecaptcha.ready(() => resolve()));
    const token = await grecaptcha.execute(key, { action });
    return typeof token === "string" && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}
import axios, { AxiosError, type AxiosInstance } from "axios";

export const TOKEN_KEY = "spots_token";
// Site Customer sessions (ADR-0030): stored on the app origin (the widget's
// iframe and the site host share it), sent as a bearer when the current
// surface is an owner-hosted one.
export const SITE_CUSTOMER_TOKEN_KEY = "site_customer_token";

/** True when the current surface is a Dedicated Site host or a widget embed. */
export function isOwnerSurface(): boolean {
  if (typeof window === "undefined") return false;
  return window.__SITE_HOST__ === true || window.location.pathname.startsWith("/embed");
}

function siteToken(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(SITE_CUSTOMER_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function persistSiteToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SITE_CUSTOMER_TOKEN_KEY, token);
    else window.localStorage.removeItem(SITE_CUSTOMER_TOKEN_KEY);
  } catch {
    // storage unavailable (SSR / privacy mode) — session simply won't stick
  }
}

declare global {
  interface Window {
    __SITE_HOST__?: boolean;
  }
}

let globalClient: AxiosInstance | null = null;

export function createClient(baseURL = "/api"): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 20000 });

  client.interceptors.request.use((config) => {
    // On an owner surface the site-customer session owns the Authorization
    // header; the platform token stays untouched in its own key.
    const token =
      typeof window !== "undefined"
        ? isOwnerSurface()
          ? siteToken()
          : window.localStorage.getItem(TOKEN_KEY)
        : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
      if (
        error.response?.status === 401 &&
        typeof window !== "undefined"
      ) {
        if (isOwnerSurface()) {
          persistSiteToken(null);
        } else if (!window.location.pathname.startsWith("/login")) {
          window.localStorage.removeItem(TOKEN_KEY);
          window.location.href = "/login";
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/** Shared client used by all services unless overridden (tests inject a mock). */
export function getClient(): AxiosInstance {
  if (!globalClient) globalClient = createClient();
  return globalClient;
}

export function setClient(client: AxiosInstance): void {
  globalClient = client;
}

export interface ApiFailure {
  code: string;
  message: string;
  status: number;
}

/** Extract the sp_be error shape from an axios error, falling back to a generic failure. */
export function toApiFailure(error: unknown): ApiFailure {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as
      | { error?: { code?: string; message?: string } }
      | undefined;
    return {
      status,
      code: body?.error?.code ?? "UNKNOWN",
      message: body?.error?.message ?? error.message
    };
  }
  return { status: 0, code: "UNKNOWN", message: "Unexpected error" };
}
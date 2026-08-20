import axios, { AxiosError, type AxiosInstance } from "axios";

export const TOKEN_KEY = "spots_token";

let globalClient: AxiosInstance | null = null;

export function createClient(baseURL = "/api"): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 20000 });

  client.interceptors.request.use((config) => {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
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
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/login";
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
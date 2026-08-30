import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// jsdom (this vitest env) provides sessionStorage but not localStorage on a
// non-http URL; components that read/write it need a per-test in-memory store.
if (typeof window !== "undefined" && typeof window.localStorage === "undefined") {
  let store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear()
    }
  });
}

beforeEach(() => {
  window.localStorage?.clear();
});

afterEach(() => {
  cleanup();
});

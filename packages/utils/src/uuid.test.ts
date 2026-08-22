import { describe, expect, it, afterEach } from "vitest";
import { uuidV4 } from "./uuid";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: realCrypto,
    configurable: true,
    writable: true
  });
});

describe("uuidV4", () => {
  it("returns a UUID-shaped v4 string when crypto.randomUUID exists", () => {
    expect(uuidV4()).toMatch(UUID_V4_RE);
  });

  it("falls back to getRandomValues when crypto.randomUUID is missing (insecure HTTP origin)", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = (i * 7 + 3) & 0xff;
          return arr;
        }
      },
      configurable: true,
      writable: true
    });

    expect(uuidV4()).toMatch(UUID_V4_RE);
    expect(uuidV4()).toBe(uuidV4());
  });

  it("survives even without any crypto API", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true
    });

    expect(uuidV4()).toMatch(UUID_V4_RE);
  });
});
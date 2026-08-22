import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Auth } from "firebase/auth";

const signInPhoneMock = vi.fn();
const signOutMock = vi.fn();
const useDeviceLanguageMock = vi.fn();
const grecaptchaResetMock = vi.fn();
const verifyMock = vi.fn().mockResolvedValue("recaptcha-token");
const verifierInstances: Array<{ render: unknown; verify: unknown }> = [];

class MockRecaptchaVerifier {
  render = vi.fn().mockResolvedValue(7);
  verify = verifyMock;
  constructor(
    _auth: unknown,
    public containerId: string,
    _opts: unknown
  ) {
    verifierInstances.push(this);
  }
}

const fakeAuth = {
  languageCode: undefined as string | undefined,
  useDeviceLanguage: useDeviceLanguageMock,
  signOut: signOutMock
} as unknown as Auth;

vi.mock("./firebase", () => ({
  getFirebaseAuth: () => fakeAuth
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: (auth: typeof fakeAuth) => auth.signOut(),
  RecaptchaVerifier: MockRecaptchaVerifier,
  signInWithPhoneNumber: signInPhoneMock
}));

describe("sendPhoneOtp", () => {
  let firebaseAuth: typeof import("./firebaseAuth");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    verifierInstances.length = 0;
    Object.assign(window, { grecaptcha: { reset: grecaptchaResetMock } });
    document.body.innerHTML = '<div id="recaptcha-container"></div>';
    firebaseAuth = await import("./firebaseAuth");
  });

  it("normalizes the phone number before sending", async () => {
    signInPhoneMock.mockResolvedValue({ confirm: vi.fn() });
    await firebaseAuth.sendPhoneOtp("+94 71 234 5678");
    expect(signInPhoneMock).toHaveBeenCalledWith(fakeAuth, "+94712345678", expect.anything());
  });

  it("throws a friendly coded error for a malformed number without sending", async () => {
    await expect(firebaseAuth.sendPhoneOtp("071 234 5678")).rejects.toMatchObject({
      code: "auth/invalid-phone-number"
    });
    expect(signInPhoneMock).not.toHaveBeenCalled();
  });

  it("creates one verifier per lifecycle and reuses it across attempts", async () => {
    signInPhoneMock.mockResolvedValue({ confirm: vi.fn() });
    await firebaseAuth.sendPhoneOtp("+94 71 234 5678");
    await firebaseAuth.sendPhoneOtp("+94 71 234 5679");
    expect(verifierInstances).toHaveLength(1);
    expect(verifierInstances[0].containerId).toBe("recaptcha-container");
  });

  it("creates a fresh verifier when the container was unmounted and remounted", async () => {
    signInPhoneMock.mockResolvedValue({ confirm: vi.fn() });
    await firebaseAuth.sendPhoneOtp("+94 71 234 5678");
    document.body.innerHTML = '<div id="recaptcha-container"></div>';
    await firebaseAuth.sendPhoneOtp("+94 71 234 5679");
    expect(verifierInstances).toHaveLength(2);
  });

  it("applies the device language before rendering the verifier", async () => {
    await firebaseAuth.sendPhoneOtp("+94 71 234 5678");
    expect(useDeviceLanguageMock).toHaveBeenCalledTimes(1);
  });

  it("does not override an explicitly set languageCode", async () => {
    fakeAuth.languageCode = "fr";
    await firebaseAuth.sendPhoneOtp("+94 71 234 5678");
    expect(useDeviceLanguageMock).not.toHaveBeenCalled();
  });

  it("resets the reCAPTCHA widget before reusing the verifier on a later attempt", async () => {
    signInPhoneMock.mockResolvedValueOnce({ confirm: vi.fn() });
    await firebaseAuth.sendPhoneOtp("+94 71 234 5678");
    await firebaseAuth.sendPhoneOtp("+94 71 234 5679");
    expect(grecaptchaResetMock).toHaveBeenCalledWith(7);
  });

  it("resets the widget when Firebase rejects the send", async () => {
    signInPhoneMock.mockRejectedValueOnce(new Error("captcha-check-failed"));
    await expect(firebaseAuth.sendPhoneOtp("+94 71 234 5678")).rejects.toThrow();
    expect(grecaptchaResetMock).toHaveBeenCalledWith(7);
  });
});
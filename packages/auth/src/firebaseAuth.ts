import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut,
  updatePassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
  type Auth,
  type ConfirmationResult
} from "firebase/auth";
import { normalizePhone } from "@myslot/utils";
import { getFirebaseAuth } from "./firebase";
import { TOKEN_KEY } from "@myslot/api";

let phoneVerifier: RecaptchaVerifier | null = null;
let phoneVerifierNode: HTMLElement | null = null;

const PHONE_RECAPTCHA_CONTAINER = "recaptcha-container";

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const userCred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  await persistToken(userCred.user);
}

export async function registerWithEmail(email: string, password: string): Promise<void> {
  const userCred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await persistToken(userCred.user);
}

export async function changePassword(newPassword: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw new Error("You must be signed in to change your password.");
  await updatePassword(auth.currentUser, newPassword);
}

export async function loginWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  const userCred = await signInWithPopup(getFirebaseAuth(), provider);
  await persistToken(userCred.user);
}

/**
 * Google sign-in for cross-origin iframes (Booking Widget): popups are
 * blocked in third-party contexts, so use the redirect flow. The page leaves
 * to Google and returns to the embed URL; the embed must then call
 * `finishGoogleRedirect()` on mount to settle the sign-in.
 */
export async function loginWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(getFirebaseAuth(), provider);
}

/**
 * Complete a Google redirect sign-in that was started by
 * `loginWithGoogleRedirect`. Returns true when a redirect sign-in was settled
 * (the widget should then refresh / continue), false when there was none.
 */
export async function finishGoogleRedirect(): Promise<boolean> {
  const auth = getFirebaseAuth();
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await persistToken(result.user);
      return true;
    }
  } catch {
    // Not a redirect result (or it failed) — treat as no redirect sign-in.
  }
  return false;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

/** Widget sign-in (ADR-0028): the backend verifies the OTP and mints a custom
 * token linking the phone to its Player account (creating it if new). */
export async function loginWithCustomToken(token: string): Promise<void> {
  const userCred = await signInWithCustomToken(getFirebaseAuth(), token);
  await persistToken(userCred.user);
}

export async function sendPhoneOtp(phone: string): Promise<ConfirmationResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw Object.assign(new Error("Enter a valid phone number with country code."), {
      code: "auth/invalid-phone-number"
    });
  }
  const auth = getFirebaseAuth();
  await auth.signOut();
  const verifier = await getPhoneVerifier(auth);
  try {
    return await signInWithPhoneNumber(auth, normalized, verifier);
  } catch (error) {
    await resetPhoneVerifier();
    throw error;
  }
}

/**
 * One ReCAPTCHA verifier per login-page lifecycle, tied to the widget
 * container's presence in the DOM. ReCAPTCHA cannot render twice into the
 * same node, so reuse the single verifier and reset its widget (per Firebase
 * docs) before each new attempt; if the container was unmounted (tab switch,
 * navigation) and remounted, create a fresh verifier for the new node.
 */
async function getPhoneVerifier(auth: Auth): Promise<RecaptchaVerifier> {
  if (phoneVerifier && phoneVerifierNode?.isConnected) {
    await resetPhoneVerifier();
    return phoneVerifier;
  }
  if (!auth.languageCode) auth.useDeviceLanguage();
  phoneVerifierNode = document.getElementById(PHONE_RECAPTCHA_CONTAINER);
  phoneVerifier = new RecaptchaVerifier(auth, PHONE_RECAPTCHA_CONTAINER, { size: "invisible" });
  return phoneVerifier;
}

export async function resetPhoneVerifier(): Promise<void> {
  if (!phoneVerifier) return;
  try {
    const widgetId = await phoneVerifier.render();
    const grecaptcha = (window as { grecaptcha?: { reset: (id: number) => void } }).grecaptcha;
    grecaptcha?.reset(widgetId);
  } catch {
    // Verifier not rendered yet — nothing to reset.
  }
}

export async function confirmPhoneOtp(
  confirmation: ConfirmationResult,
  otp: string
): Promise<void> {
  const userCred = await confirmation.confirm(otp);
  await persistToken(userCred.user);
}

export async function logoutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

async function persistToken(user: { getIdToken: () => Promise<string> }): Promise<void> {
  const token = await user.getIdToken();
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
}
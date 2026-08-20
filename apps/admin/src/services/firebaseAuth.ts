import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { TOKEN_KEY } from "@spots/api";

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const userCred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  await persistToken(userCred.user);
}

export async function registerWithEmail(email: string, password: string): Promise<void> {
  const userCred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await persistToken(userCred.user);
}

export async function loginWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  const userCred = await signInWithPopup(getFirebaseAuth(), provider);
  await persistToken(userCred.user);
}

export async function sendPhoneOtp(phone: string): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  await auth.signOut();
  const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
  return signInWithPhoneNumber(auth, phone, verifier);
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
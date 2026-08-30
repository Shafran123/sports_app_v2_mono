/**
 * Analytics Consent (ADR-0043): a visitor's Accept/Reject choice for
 * analytics, recorded per origin in local storage — the platform sets no
 * cookies. Versioned so a privacy-policy change re-prompts. The banner is
 * blocking until a choice is made; once a choice exists it hides unless the
 * visitor explicitly reopens the consent manager to change it.
 */

export type ConsentChoice = "accepted" | "rejected";

export interface ConsentRecord {
  choice: ConsentChoice;
  version: number;
  updatedAt: string;
}

/** Bump when the privacy policy changes to re-prompt every visitor. */
export const CONSENT_VERSION = 1;

export const CONSENT_STORAGE_KEY = "spots_consent";

type Listener = () => void;

const listeners = new Set<Listener>();

function readRecord(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed.choice !== "accepted" && parsed.choice !== "rejected") return null;
    if (typeof parsed.version !== "number") return null;
    return parsed as ConsentRecord;
  } catch {
    return null;
  }
}

function writeRecord(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  const record: ConsentRecord = {
    choice,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString()
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // storage unavailable — the choice isn't persisted, but must never crash
  }
}

/** The current effective choice, or null when none recorded or version-stale. */
export function getConsentChoice(): ConsentChoice | null {
  const record = readRecord();
  if (!record || record.version !== CONSENT_VERSION) return null;
  return record.choice;
}

/** Whether the visitor has already recorded a valid choice. */
export function hasConsentChoice(): boolean {
  return getConsentChoice() !== null;
}

let managerOpen = false;

/** Whether the consent banner should currently be visible. */
export function isConsentBannerVisible(): boolean {
  return !hasConsentChoice() || managerOpen;
}

/** Reopen the consent manager so a visitor can review or change a choice. */
export function openConsentManager(): void {
  managerOpen = true;
  notify();
}

/** Close the manager without changing an existing choice. */
export function closeConsentManager(): void {
  managerOpen = false;
  notify();
}

/** Record (or change) the visitor's choice and dismiss the banner. */
export function setConsentChoice(choice: ConsentChoice): void {
  writeRecord(choice);
  managerOpen = false;
  notify();
}

/** Subscribe to consent state changes. Returns an unsubscribe function. */
export function subscribeConsentChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

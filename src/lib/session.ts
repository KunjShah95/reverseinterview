import { firebaseAuth } from "./firebase-auth";

// Anonymous session id stored in localStorage so a visitor can find their past analyses.
const KEY = "rev-int-session";

// Fallback used when localStorage is blocked (strict privacy settings / some
// extensions). Keeps a stable id for the lifetime of the page so a blocked-
// storage browser still tags new records consistently instead of throwing.
let memoryFallback: string | null = null;

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";

  const firebaseUserId = firebaseAuth?.currentUser?.uid?.trim();
  if (firebaseUserId) return firebaseUserId;

  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    if (!memoryFallback) memoryFallback = crypto.randomUUID();
    return memoryFallback;
  }
}

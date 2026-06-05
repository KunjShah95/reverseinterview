import { firebaseAuth } from "./firebase-auth";

// Anonymous session id stored in localStorage so a visitor can find their past analyses.
const KEY = "rev-int-session";

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";

  const firebaseUserId = firebaseAuth?.currentUser?.uid?.trim();
  if (firebaseUserId) return firebaseUserId;

  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

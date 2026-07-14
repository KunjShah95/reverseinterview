// Server-only Firebase Admin initialization. Do NOT import from client code.
//
// The client-side `firebase.ts` app is browser-only (Auth needs a browser), so
// the server has no Firestore access through it. This module gives server
// functions a durable Firestore handle via the Admin SDK, which bypasses
// security rules and is the correct tool for trusted server writes.
//
// Credentials are read from env in three supported shapes (first match wins):
//   1. FIREBASE_SERVICE_ACCOUNT      — full service-account JSON (or base64 of it)
//   2. GOOGLE_APPLICATION_CREDENTIALS — path handled natively by applicationDefault()
//   3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
//
// When no credentials are present, getAdminDb() returns null and callers fall
// back to their in-memory path, so local dev keeps working without setup.

import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type ServiceAccountShape = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function readEnv(key: string): string | undefined {
  const value = typeof process !== "undefined" && process.env ? process.env[key] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseServiceAccount(): ServiceAccountShape | null {
  const raw = readEnv("FIREBASE_SERVICE_ACCOUNT");
  if (raw) {
    try {
      // Accept either raw JSON or base64-encoded JSON.
      const json = raw.startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(json) as Record<string, string>;
      const projectId = parsed.project_id ?? parsed.projectId;
      const clientEmail = parsed.client_email ?? parsed.clientEmail;
      const privateKey = parsed.private_key ?? parsed.privateKey;
      if (projectId && clientEmail && privateKey) {
        return { projectId, clientEmail, privateKey: normalizeKey(privateKey) };
      }
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", err);
    }
  }

  const projectId = readEnv("FIREBASE_PROJECT_ID") ?? readEnv("VITE_FIREBASE_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_PRIVATE_KEY");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey: normalizeKey(privateKey) };
  }

  return null;
}

// Env vars often store the PEM key with literal "\n" sequences; restore them.
function normalizeKey(key: string): string {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

let cachedDb: Firestore | null | undefined;

function initAdminApp(): App | null {
  if (getApps().length) return getApps()[0]!;

  const serviceAccount = parseServiceAccount();
  if (serviceAccount) {
    return initializeApp({ credential: cert(serviceAccount) });
  }

  // Fall back to ADC (GOOGLE_APPLICATION_CREDENTIALS / metadata server) if present.
  if (readEnv("GOOGLE_APPLICATION_CREDENTIALS")) {
    try {
      return initializeApp({ credential: applicationDefault() });
    } catch (err) {
      console.error("applicationDefault() init failed:", err);
    }
  }

  return null;
}

/**
 * Returns a durable Admin Firestore handle, or null when no server credentials
 * are configured (callers should fall back to their in-memory path).
 * Result is memoized — including the null result — so we don't retry init on
 * every call in an unconfigured environment.
 */
export function getAdminDb(): Firestore | null {
  if (cachedDb !== undefined) return cachedDb;

  if (typeof window !== "undefined") {
    cachedDb = null;
    return cachedDb;
  }

  try {
    const app = initAdminApp();
    cachedDb = app ? getFirestore(app) : null;
  } catch (err) {
    console.error("Firebase Admin init failed:", err);
    cachedDb = null;
  }

  if (!cachedDb) {
    console.warn(
      "[job-store] Firebase Admin not configured — analysis jobs will use volatile in-memory storage and will not survive serverless cold starts. Set FIREBASE_SERVICE_ACCOUNT to enable durable jobs.",
    );
  }

  return cachedDb;
}

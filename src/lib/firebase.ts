import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  databaseURL?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

/**
 * Read a VITE_* env var with dual fallback:
 * - `import.meta.env` – works in Vite client bundles (inlined at build time)
 * - `process.env`    – fallback for Vite SSR / Vinxi server bundles where
 *                       import.meta.env may resolve differently at runtime
 *                       (e.g. Vercel serverless functions)
 */
function readEnvVar(key: string): string | undefined {
  // Try Vite's import.meta.env first (works in both client and SSR builds)
  try {
    const viteVal = import.meta.env[key];
    if (typeof viteVal === "string" && viteVal.trim()) return viteVal.trim();
  } catch {
    // import.meta may not be polyfilled in all server runtimes
  }
  // Fallback to process.env for server runtimes where Vite's SSR env
  // polyfill isn't active (e.g. certain Vinxi serverless builds)
  try {
    const procVal =
      typeof process !== "undefined" && process.env ? process.env[key] : undefined;
    if (typeof procVal === "string" && procVal.trim()) return procVal.trim();
  } catch {
    // process.env may not be available in edge runtimes
  }
  return undefined;
}

// Only attempt Firebase initialization in the browser – Firebase Auth is
// browser-only and the SDK uses IndexedDB / popups / redirects that don't
// exist in Node.js / edge runtimes.
const isBrowser = typeof window !== "undefined";

const firebaseConfig: FirebaseConfig = {
  apiKey: readEnvVar("VITE_FIREBASE_API_KEY"),
  authDomain: readEnvVar("VITE_FIREBASE_AUTH_DOMAIN"),
  databaseURL: readEnvVar("VITE_FIREBASE_DATABASE_URL"),
  projectId: readEnvVar("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnvVar("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnvVar("VITE_FIREBASE_APP_ID"),
  measurementId: readEnvVar("VITE_FIREBASE_MEASUREMENT_ID"),
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

export const firebaseApp: FirebaseApp | null =
  isBrowser && hasFirebaseConfig
    ? getApps().length
      ? getApp()
      : initializeApp(firebaseConfig as Required<FirebaseConfig>)
    : null;


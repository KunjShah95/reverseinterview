import {
  getFirestore,
  terminate,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp } from "./firebase";
import { CLOUD_SYNC_BLOCKED_EVENT } from "./cloud-sync-notice";
import type { LocalAnalysisRecord } from "./local-analysis";

let db: Firestore | null = null;

// ---------------------------------------------------------------------------
// Browser-level connection blocking
//
// Ad-blockers, privacy extensions (uBlock, AdBlock, Ghostery, …) and Brave
// Shields frequently block the SDK's requests to firestore.googleapis.com.
// The requests die with net::ERR_BLOCKED_BY_CLIENT and the SDK then retries
// forever, which floods the console and makes every Firestore call hang.
//
// Once we detect a block-like failure we (a) remember it, (b) fail fast on
// every subsequent call so pages fall back to localStorage instead of hanging,
// and (c) terminate the SDK connection to stop the background reconnect loop.
// The UI can read isFirestoreBlocked() to explain the situation to the user.
// ---------------------------------------------------------------------------

let firestoreBlocked = false;
let blockReason: string | null = null;
let consecutiveFailures = 0;

// If a single operation doesn't resolve in this long, the connection is almost
// certainly blocked or dead (the SDK would normally answer in <1s).
const OP_TIMEOUT_MS = 6_000;

// Require two consecutive block-like failures before permanently disabling
// cloud sync for the session — a single transient network blip ("Failed to
// fetch" on flaky Wi-Fi) shouldn't burn the whole session.
const BLOCK_THRESHOLD = 2;

export function isFirestoreBlocked(): boolean {
  return firestoreBlocked;
}

function getDb(): Firestore {
  if (!firebaseApp) throw new Error("Firebase not configured");
  if (!db) db = getFirestore(firebaseApp);
  return db;
}

function looksLikeBlockedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|network error|network request|load failed|ERR_|offline|off line|could not connect|connection|timed out|timeout/i.test(
    message,
  );
}

function markBlocked(reason: string) {
  if (firestoreBlocked) return;
  firestoreBlocked = true;
  blockReason = reason;
  console.warn(
    "[firestore] Firestore appears to be blocked in this browser (ad-blocker / privacy extension?). Falling back to on-device storage.",
    reason,
  );
  // Tear down the SDK connection so it stops reconnecting in the background.
  if (db) {
    const doomed = db;
    db = null;
    void terminate(doomed).catch(() => {});
  }
  // Tell any open page (analyze / report / history / dashboard) that cloud sync
  // just went dark so the banner and the one-time toast fire reliably no matter
  // which call path tripped the threshold.
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CLOUD_SYNC_BLOCKED_EVENT));
    }
  } catch {
    // non-browser context — ignore
  }
}

// Wrap every Firestore operation with a hard timeout and block detection.
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  if (firestoreBlocked) {
    throw new Error(blockReason ?? "Firestore is blocked in this browser.");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Firestore request timed out (connection blocked?)")),
          OP_TIMEOUT_MS,
        );
      }),
    ]);
    consecutiveFailures = 0;
    return result;
  } catch (err) {
    if (looksLikeBlockedError(err)) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= BLOCK_THRESHOLD) {
        markBlocked(err instanceof Error ? err.message : "unknown error");
      }
    } else {
      consecutiveFailures = 0;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function recordToFirestore(record: LocalAnalysisRecord) {
  return {
    ...record,
    createdAt: Timestamp.fromDate(new Date(record.createdAt)),
    startedAt: record.startedAt
      ? Timestamp.fromDate(new Date(record.startedAt))
      : null,
    completedAt: record.completedAt
      ? Timestamp.fromDate(new Date(record.completedAt))
      : null,
  };
}

function firestoreToRecord(data: Record<string, unknown>): LocalAnalysisRecord {
  const createdAt =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : (data.createdAt as string);
  const startedAt =
    data.startedAt instanceof Timestamp
      ? data.startedAt.toDate().toISOString()
      : (data.startedAt as string | null);
  const completedAt =
    data.completedAt instanceof Timestamp
      ? data.completedAt.toDate().toISOString()
      : (data.completedAt as string | null);

  return {
    ...(data as unknown as Omit<LocalAnalysisRecord, "createdAt" | "startedAt" | "completedAt">),
    createdAt,
    startedAt,
    completedAt,
  };
}

export async function saveReportToFirestore(
  uid: string,
  record: LocalAnalysisRecord,
): Promise<void> {
  await guarded(async () => {
    const database = getDb();
    await setDoc(
      doc(database, "users", uid, "reports", record.id),
      recordToFirestore(record),
      { merge: true },
    );
  });
}

export async function getUserReport(
  uid: string,
  reportId: string,
): Promise<LocalAnalysisRecord | null> {
  return guarded(async () => {
    const database = getDb();
    const snapshot = await getDoc(
      doc(database, "users", uid, "reports", reportId),
    );
    if (!snapshot.exists()) return null;
    return firestoreToRecord(snapshot.data() as Record<string, unknown>);
  });
}

export async function listUserReports(
  uid: string,
  maxResults = 50,
): Promise<LocalAnalysisRecord[]> {
  return guarded(async () => {
    const database = getDb();
    const q = query(
      collection(database, "users", uid, "reports"),
      orderBy("createdAt", "desc"),
      limit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) =>
      firestoreToRecord(d.data() as Record<string, unknown>),
    );
  });
}

export async function getUserDashboardStats(uid: string): Promise<{
  total: number;
  proceed: number;
  caution: number;
  avoid: number;
  running: number;
}> {
  return guarded(async () => {
    const database = getDb();
    const q = query(
      collection(database, "users", uid, "reports"),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);

    let proceed = 0;
    let caution = 0;
    let avoid = 0;
    let running = 0;
    let total = 0;

    for (const d of snapshot.docs) {
      total++;
      const data = d.data();
      const status = data.status as string;

      if (status === "queued" || status === "running") {
        running++;
        continue;
      }

      const recommendation =
        (data.result as Record<string, unknown>)?.orchestrator as
          | Record<string, unknown>
          | undefined;

      const rec = recommendation?.recommendation as string | undefined;
      if (rec === "proceed") proceed++;
      else if (rec === "avoid") avoid++;
      else if (rec === "caution") caution++;
    }

    return { total, proceed, caution, avoid, running };
  });
}

import type { LocalAnalysisRecord } from "./local-analysis";
import { saveReportToFirestore, listUserReports } from "./firestore";

const LOCAL_ANALYSES_KEY = "rev-int-local-analyses";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAnalyses(): LocalAnalysisRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ANALYSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAnalysisRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAnalyses(records: LocalAnalysisRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(records.slice(0, 50)));
}

/**
 * Persist an analysis record to Firestore for the given user.
 * Falls back silently if the user is not authenticated.
 */
export async function persistAnalysisRecord(record: LocalAnalysisRecord, uid?: string | null) {
  const cleanUid = uid?.trim();
  if (!cleanUid) return;
  try {
    await saveReportToFirestore(cleanUid, record);
  } catch (err) {
    console.error("Failed to persist analysis to Firestore:", err);
  }
}

/**
 * Sync reports from Firestore into localStorage so they're available
 * offline or when the server-side DB is unreachable.
 */
export async function syncFirebaseReportsToLocalCache(uid?: string | null) {
  const cleanUid = uid?.trim();
  if (!cleanUid || !canUseStorage()) return;

  try {
    const remoteRecords = await listUserReports(cleanUid, 100);
    const existing = readAnalyses().filter((record: LocalAnalysisRecord) => record.sessionId !== cleanUid);
    writeAnalyses([...remoteRecords, ...existing]);
  } catch (err) {
    console.error("Failed to sync Firestore reports to local cache:", err);
  }
}

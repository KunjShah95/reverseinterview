// Durable, cross-instance store for in-flight analysis jobs.
//
// Why this exists: the previous implementation kept job state in a module-level
// `Map`. On serverless / Fluid Compute that Map lives in one instance's RAM, so
// when the app goes idle (cold start) or a poll lands on a different instance,
// the job vanishes and polling returns "not found". That produced the
// "inactive -> repeated heuristic data" and "history not stored" symptoms.
//
// This store persists jobs to Firestore (via Admin) so state survives cold
// starts and is visible from any instance. When Admin credentials are absent
// (local dev), it transparently falls back to an in-memory Map so nothing
// breaks — it just isn't durable there.

import { getAdminDb } from "./firebase-admin.server";
import type { PartialAnalysisResult, PreliminaryResponse } from "./analysis-types";
import type { RunProgress } from "./run-analysis";

export type JobStatus = "queued" | "running" | "complete" | "partial" | "failed";

export type JobRecord = {
  status: JobStatus;
  error?: string;
  progress: RunProgress;
  result?: PartialAnalysisResult;
  preliminary?: PreliminaryResponse;
  updatedAt: string;
  // Unix-ms expiry. Firestore rows past this are treated as gone so stale jobs
  // don't linger (also lets a TTL policy reap them server-side).
  expiresAt: number;
};

const COLLECTION = "analysisJobs";
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

// In-memory fallback (dev / no Admin creds). Not durable across instances.
const memory = new Map<string, JobRecord>();

function withExpiry(record: Omit<JobRecord, "updatedAt" | "expiresAt">): JobRecord {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + TTL_MS,
  };
}

export async function setJob(
  id: string,
  record: Omit<JobRecord, "updatedAt" | "expiresAt">,
): Promise<void> {
  const full = withExpiry(record);
  const db = getAdminDb();
  if (db) {
    try {
      // Firestore rejects `undefined` fields — strip them before writing.
      await db.collection(COLLECTION).doc(id).set(pruneUndefined(full), { merge: false });
      return;
    } catch (err) {
      console.error("[job-store] Firestore setJob failed, using memory:", err);
    }
  }
  memory.set(id, full);
}

export async function getJob(id: string): Promise<JobRecord | null> {
  const db = getAdminDb();
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).doc(id).get();
      if (!snap.exists) return memory.get(id) ?? null;
      const data = snap.data() as JobRecord;
      if (data.expiresAt && data.expiresAt < Date.now()) return null;
      return data;
    } catch (err) {
      console.error("[job-store] Firestore getJob failed, using memory:", err);
    }
  }
  const local = memory.get(id);
  if (local && local.expiresAt < Date.now()) {
    memory.delete(id);
    return null;
  }
  return local ?? null;
}

// Read-modify-write helper so swarm patches don't clobber concurrent updates
// from parallel specialist agents. Retries once on transaction contention.
export async function updateJob(
  id: string,
  mutate: (current: JobRecord | null) => JobRecord | null,
): Promise<void> {
  const db = getAdminDb();
  if (db) {
    try {
      const ref = db.collection(COLLECTION).doc(id);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? (snap.data() as JobRecord) : null;
        const next = mutate(current);
        if (next) tx.set(ref, pruneUndefined(next), { merge: false });
      });
      return;
    } catch (err) {
      console.error("[job-store] Firestore updateJob failed, using memory:", err);
    }
  }
  const next = mutate(memory.get(id) ?? null);
  if (next) memory.set(id, next);
}

function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

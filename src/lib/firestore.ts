import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp } from "./firebase";
import type { LocalAnalysisRecord } from "./local-analysis";

let db: Firestore | null = null;

function getDb(): Firestore {
  if (!firebaseApp) throw new Error("Firebase not configured");
  if (!db) db = getFirestore(firebaseApp);
  return db;
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
  const database = getDb();
  await setDoc(
    doc(database, "users", uid, "reports", record.id),
    recordToFirestore(record),
    { merge: true },
  );
}

export async function getUserReport(
  uid: string,
  reportId: string,
): Promise<LocalAnalysisRecord | null> {
  const database = getDb();
  const snapshot = await getDoc(
    doc(database, "users", uid, "reports", reportId),
  );
  if (!snapshot.exists()) return null;
  return firestoreToRecord(snapshot.data() as Record<string, unknown>);
}

export async function listUserReports(
  uid: string,
  maxResults = 50,
): Promise<LocalAnalysisRecord[]> {
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
}

export async function getUserDashboardStats(uid: string): Promise<{
  total: number;
  proceed: number;
  caution: number;
  avoid: number;
  running: number;
}> {
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
}

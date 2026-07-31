import { toast } from "sonner";

// Shared event name dispatched whenever a Firestore write fails because the
// browser is blocking Firestore (ad-blocker / privacy extension). Kept in one
// place so listeners in the analyze/report/history/dashboard pages can't drift.
export const CLOUD_SYNC_BLOCKED_EVENT = "offerguard:cloud-sync-blocked";

// Warns the user (once per page session) when Firestore cloud sync is blocked
// by an ad blocker / privacy extension, so they know their report is still
// safely saved on this device even though cross-device history won't sync.
let warned = false;

export function maybeWarnCloudSyncBlocked(): boolean {
  if (warned) return false;
  warned = true;
  toast.warning(
    "Report saved on this device, but cloud sync is blocked in this browser. An ad blocker or privacy extension is blocking Firestore — allow firestore.googleapis.com (or disable the blocker for this site) to keep history across devices.",
    { duration: 8000 },
  );
  return true;
}

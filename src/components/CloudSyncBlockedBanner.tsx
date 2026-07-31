import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

/**
 * Small dismissible notice shown on dashboard/history pages when the browser
 * is blocking Firestore (ad-blocker / privacy extension / Brave Shields), so
 * users understand their reports are still saved locally but won't sync.
 */
export function CloudSyncBlockedBanner({ visible }: { visible: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (!visible || dismissed) return null;

  return (
    <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-[color:var(--caution)]/40 bg-[color:var(--caution)]/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--caution)" }} />
        <div>
          <p className="text-sm font-semibold text-ink">Cloud sync is blocked in this browser</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-body">
            An ad blocker or privacy extension is blocking Firestore, so your reports are only
            being saved on this device. Allow{" "}
            <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">
              firestore.googleapis.com
            </code>{" "}
            (or disable the blocker for this site) to keep history synced across devices.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="rounded-full p-1 text-body/60 transition-colors hover:bg-white/70 hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}

import { AlertTriangle, BarChart3, CheckCircle2 } from "lucide-react";
import type { PreliminaryResponse } from "@/lib/analysis-types";

export function PreliminaryCard({ preliminary }: { preliminary: PreliminaryResponse }) {
  return (
    <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-heading" />
        <span className="text-sm font-semibold text-ink">Quick read</span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-ink/70">Vibe:</span>
        <div className="flex-1 h-2 rounded-full bg-ink/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${preliminary.vibeScore}%`,
              backgroundColor: preliminary.vibeScore >= 60 ? "var(--safe)" : preliminary.vibeScore >= 35 ? "var(--caution)" : "var(--danger)",
            }}
          />
        </div>
        <span className="text-sm font-semibold text-ink w-10 text-right">{preliminary.vibeScore}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          {preliminary.topRedFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700 mb-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{flag}</span>
            </div>
          ))}
        </div>
        <div>
          {preliminary.topGreenFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-green-700 mb-1">
              <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
              <span>{flag}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-body/60">Full deep-dive analysis still running in background...</p>
    </div>
  );
}

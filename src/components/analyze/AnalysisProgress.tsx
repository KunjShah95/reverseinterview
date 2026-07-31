import { CheckCircle2, Loader2 } from "lucide-react";
import { AGENT_STEPS } from "@/lib/analyze-constants";
import type { RunProgress } from "@/lib/run-analysis";

export function AnalysisProgress({ runProgress }: { runProgress: RunProgress }) {
  return (
    <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Loader2 size={16} className="animate-spin text-heading" />
        <span className="text-sm font-semibold text-ink">AI agents analyzing your text</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AGENT_STEPS.map((step) => {
          const Icon = step.icon;
          const status = runProgress[step.id];
          const isRunning = status === "running";
          const isDone = status === "complete";
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                isDone
                  ? "bg-green-50 text-green-800"
                  : isRunning
                    ? "bg-blue-50 text-blue-800"
                    : "bg-ink/5 text-ink/40"
              }`}
            >
              <Icon
                size={16}
                className={isDone ? "text-green-600" : isRunning ? "text-blue-600" : ""}
              />
              <span className="flex-1 font-medium">{step.label}</span>
              {isDone && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
              {isRunning && (
                <Loader2 size={14} className="animate-spin text-blue-600 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-center text-body/70">
        Agents run in parallel. Report opens automatically when complete.
      </p>
    </div>
  );
}

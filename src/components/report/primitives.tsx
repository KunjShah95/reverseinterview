import { AlertTriangle, Loader2 } from "lucide-react";
import type { AgentId, AnalysisProgress, Severity } from "@/lib/analysis-types";

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6 shadow-sm">
      <h2 className="font-display text-2xl text-ink" style={{ letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-body">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SeverityChip({ s }: { s: Severity }) {
  const bg = s === "high" ? "var(--danger)" : s === "medium" ? "var(--caution)" : "var(--safe)";
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
      style={{ backgroundColor: bg }}
    >
      {s}
    </span>
  );
}

export function Gauge({ label, v }: { label: string; v: number }) {
  const color = v >= 65 ? "var(--danger)" : v >= 35 ? "var(--caution)" : "var(--safe)";
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{Math.round(v)}</p>
      <div className="mt-2 h-1.5 rounded-full bg-ink/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function MiniBar({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const good = invert ? v < 50 : v >= 50;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-body">
        <span>{label}</span>
        <span>{Math.round(v)}</span>
      </div>
      <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            backgroundColor: good ? "var(--safe)" : "var(--caution)",
          }}
        />
      </div>
    </div>
  );
}

export function List({ title, items, kind }: { title: string; items: string[]; kind: "risk" | "green" }) {
  const color = kind === "risk" ? "var(--danger)" : "var(--safe)";
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-4">
      <p className="text-sm font-medium text-ink mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="text-sm text-body flex gap-2">
            <span
              className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink capitalize">{value}</p>
    </div>
  );
}

export function StatusBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/60 px-4 py-3 text-sm text-ink">
      {text}
    </div>
  );
}

export function SectionFallback({
  title,
  progress,
}: {
  title: string;
  progress?: AnalysisProgress[AgentId];
}) {
  // Only pending/running are still "in flight". failed/skipped (and any other
  // non-active state) are terminal — show a static message, never an endless
  // spinner, so a torn-down or timed-out run doesn't spin forever.
  const status = progress?.status;
  const inFlight = status === "pending" || status === "running" || status === undefined;
  return (
    <Card title={title}>
      <div className="flex min-h-24 items-center gap-3 rounded-lg border border-ink/10 bg-cream/40 p-4 text-sm text-body">
        {inFlight ? (
          <Loader2 size={16} className="shrink-0 animate-spin text-ink/60" />
        ) : (
          <AlertTriangle size={16} className="shrink-0 text-ink/60" />
        )}
        <span>
          {inFlight
            ? "Waiting for this agent to finish."
            : status === "skipped"
              ? progress?.error || "This section was skipped — no data was available."
              : progress?.error || "This agent failed, but the rest of the swarm can continue."}
        </span>
      </div>
    </Card>
  );
}

export function MiniStatus({ label, progress }: { label: string; progress?: AnalysisProgress[AgentId] }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-2 text-sm text-ink capitalize">{progress?.status ?? "pending"}</p>
    </div>
  );
}

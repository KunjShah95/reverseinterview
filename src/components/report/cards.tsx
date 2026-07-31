import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Loader2,
  Quote,
  ShieldAlert,
  Siren,
  UserSearch,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AnalysisProgress,
  AnalysisStatus,
  PartialAnalysisResult,
} from "@/lib/analysis-types";
import { ACTIVE_STATUSES, AGENT_LABELS } from "@/lib/report-constants";
import {
  Card,
  Gauge,
  List,
  MetricCard,
  MiniBar,
  MiniStatus,
  SectionFallback,
  SeverityChip,
} from "./primitives";

function recColor(rec: string) {
  if (rec === "proceed") return { bg: "var(--safe)", label: "Proceed" };
  if (rec === "caution") return { bg: "var(--caution)", label: "Proceed with caution" };
  return { bg: "var(--danger)", label: "Avoid" };
}

export function VerdictHero({
  r,
  status,
  error,
}: {
  r: PartialAnalysisResult;
  status: AnalysisStatus;
  error: string | null;
}) {
  if (!r.orchestrator) {
    return (
      <section className="px-4 sm:px-6 md:px-10 pt-28 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-cream">
              {status === "failed" ? (
                <AlertTriangle size={14} />
              ) : (
                <Loader2 size={14} className="animate-spin" />
              )}
              {status === "failed" ? "Analysis failed" : "Swarm running"}
            </span>
            <span className="text-sm text-body">
              {r.roleTitle || "Role pending"} /{" "}
              <span className="font-medium text-ink">{r.company || "Company pending"}</span>
            </span>
          </div>
          <h1
            className="font-display text-3xl sm:text-5xl md:text-6xl text-ink"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.02 }}
          >
            {status === "failed"
              ? error || "The swarm could not complete this report."
              : "Specialist agents are analyzing this offer."}
          </h1>
        </div>
      </section>
    );
  }
  const c = recColor(r.orchestrator.recommendation);
  return (
    <section className="px-4 sm:px-6 md:px-10 pt-28 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: c.bg }}
          >
            {r.orchestrator.recommendation === "proceed" ? (
              <CheckCircle2 size={14} />
            ) : r.orchestrator.recommendation === "avoid" ? (
              <ShieldAlert size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {c.label}
          </span>
          <span className="text-sm text-body">
            {r.roleTitle} · <span className="font-medium text-ink">{r.company}</span>
          </span>
        </div>
        <h1
          className="font-display text-3xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.02 }}
        >
          {r.orchestrator.verdict}
        </h1>
      </div>
    </section>
  );
}

export function TruthScoreCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.orchestrator) {
    return <SectionFallback title="TruthScore breakdown" progress={progress.orchestrator} />;
  }
  const items = [
    { label: "Transparency", v: r.orchestrator.truthScore.transparency },
    { label: "Work-life balance", v: r.orchestrator.truthScore.workLifeBalance },
    { label: "Career growth", v: r.orchestrator.truthScore.careerGrowth },
    { label: "Hiring integrity", v: r.orchestrator.truthScore.hiringIntegrity },
    { label: "Compensation fairness", v: r.orchestrator.truthScore.compensationFairness },
  ];
  return (
    <Card title="TruthScore breakdown" subtitle="0 — concerning · 100 — excellent">
      <div className="space-y-4">
        {items.map((it) => (
          <div key={it.label}>
            <div className="flex justify-between text-sm">
              <span className="text-ink">{it.label}</span>
              <span className="font-medium text-ink">{Math.round(it.v)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${it.v}%`,
                  backgroundColor:
                    it.v >= 65 ? "var(--safe)" : it.v >= 35 ? "var(--caution)" : "var(--danger)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <List title="Top risks" items={r.orchestrator.topRisks} kind="risk" />
        <List title="What looks good" items={r.orchestrator.topGreens} kind="green" />
      </div>
    </Card>
  );
}

export function ToxicityCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.culture) {
    return <SectionFallback title="Culture & toxicity" progress={progress.culture} />;
  }
  return (
    <Card title="Culture & toxicity" subtitle={r.culture.summary}>
      <div className="text-sm text-ink mb-3">
        Toxicity score: <span className="font-semibold">{Math.round(r.culture.toxicityScore)}</span>
        /100
      </div>
      <div className="space-y-3">
        {r.culture.flags.length === 0 && (
          <p className="text-sm text-body">No major toxic phrases detected.</p>
        )}
        {r.culture.flags.map((f, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-cream/50 p-3">
            <div className="flex items-start gap-2">
              <SeverityChip s={f.severity} />
              <div className="flex-1">
                <p className="font-mono text-sm text-ink">
                  <Quote size={12} className="inline mr-1 -mt-1 opacity-50" />
                  {f.phrase}
                </p>
                <p className="mt-1 text-sm text-body">{f.hiddenMeaning}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function BurnoutGhostCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.burnout && !r.ghost) {
    return <SectionFallback title="Burnout & ghost-hiring" progress={progress.burnout} />;
  }
  return (
    <Card title="Burnout & ghost-hiring">
      <div className="grid grid-cols-2 gap-4 mb-4">
        {r.burnout ? (
          <Gauge label="Burnout risk" v={r.burnout.burnoutRisk} />
        ) : (
          <MiniStatus label="Burnout risk" progress={progress.burnout} />
        )}
        {r.ghost ? (
          <Gauge label="Ghost-hire risk" v={r.ghost.ghostScore} />
        ) : (
          <MiniStatus label="Ghost-hire risk" progress={progress.ghost} />
        )}
      </div>
      {r.burnout && (
        <>
          <p className="text-sm text-body mb-2">{r.burnout.summary}</p>
          <ul className="text-sm text-body list-disc pl-5 space-y-1 mb-4">
            {r.burnout.signals.slice(0, 4).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {r.ghost && r.ghost.signals.length > 0 && (
        <>
          <p className="text-sm font-medium text-ink mt-3 mb-1">Ghost-hire signals</p>
          <ul className="text-sm text-body list-disc pl-5 space-y-1">
            {r.ghost.signals.slice(0, 4).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function SalaryCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.salary) {
    return <SectionFallback title="Salary fairness" progress={progress.salary} />;
  }
  const color =
    r.salary.verdict === "underpaid"
      ? "var(--danger)"
      : r.salary.verdict === "fair"
        ? "var(--safe)"
        : r.salary.verdict === "overpaid"
          ? "var(--caution)"
          : "var(--body)";
  return (
    <Card title="Salary fairness">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white capitalize"
          style={{ backgroundColor: color }}
        >
          {r.salary.verdict}
        </span>
        <span className="text-sm text-body">
          Confidence: <span className="text-ink font-medium">{r.salary.confidence}</span>
        </span>
      </div>
      <p className="text-sm text-ink">
        <span className="font-medium">
          {r.salary.marketData ? "Market range" : "Estimated market range"}:
        </span>{" "}
        {r.salary.marketRangeEstimate}
      </p>
      {r.salary.marketData && (
        <p className="mt-1 text-xs text-body/70">
          Real data from {r.salary.marketData.source} ·{" "}
          {r.salary.marketData.sampleSize.toLocaleString()} live postings
          {r.salary.marketData.location ? ` · ${r.salary.marketData.location}` : ""}
        </p>
      )}
      <p className="mt-2 text-sm text-body">{r.salary.reasoning}</p>
    </Card>
  );
}

export function LieDetectorCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.lie) {
    return <SectionFallback title="HR claim verification" progress={progress.lie} />;
  }
  if (!r.lie.mismatches.length && !r.lie.discrepancies?.length) return null;
  return (
    <Card title="HR claim verification" subtitle={r.lie.summary}>
      <div className="space-y-4">
        {r.lie.mismatches.map((m, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-cream/50 p-3">
            <div className="text-sm">
              <p className="text-ink">
                <span className="font-medium text-ink">Claim:</span> "{m.claim}"
              </p>
              <p className="mt-1 text-body">
                <span className="font-medium text-ink">Evidence:</span> {m.evidence}
              </p>
              <p className="mt-1 text-xs text-body/70">Confidence: {m.confidence}</p>
            </div>
          </div>
        ))}

        {r.lie.discrepancies && r.lie.discrepancies.length > 0 && (
          <div className="mt-6 border-t border-ink/10 pt-6">
            <p className="text-sm font-semibold text-ink mb-4">Bait-and-Switch Timeline Audit</p>
            <div className="space-y-6 relative pl-6 border-l-2 border-ink/15 ml-3">
              {r.lie.discrepancies.map((d, idx) => (
                <div key={idx} className="relative group">
                  <span className={`absolute -left-[31px] top-1.5 rounded-full w-4 h-4 border-2 border-white flex items-center justify-center ${
                    d.severity === "high" ? "bg-red-500" : d.severity === "medium" ? "bg-yellow-500" : "bg-green-500"
                  }`} />
                  <div className="rounded-xl border border-ink/10 bg-cream/10 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink/75 bg-cream/70 rounded-full px-2 py-0.5">{d.category}</span>
                      <SeverityChip s={d.severity} />
                    </div>
                    <p className="text-sm text-ink/90 font-medium mb-3">{d.assessment}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {d.jdClaim && (
                        <div className="rounded-lg bg-white border border-ink/5 p-2.5">
                          <span className="font-semibold text-body block mb-1 text-[10px] uppercase">Stage 1: JD</span>
                          <span className="italic text-ink">"{d.jdClaim}"</span>
                        </div>
                      )}
                      {d.chatClaim && (
                        <div className="rounded-lg bg-white border border-ink/5 p-2.5">
                          <span className="font-semibold text-body block mb-1 text-[10px] uppercase">Stage 2: Chats</span>
                          <span className="italic text-ink">"{d.chatClaim}"</span>
                        </div>
                      )}
                      {d.contractClaim && (
                        <div className="rounded-lg bg-white border border-ink/5 p-2.5">
                          <span className="font-semibold text-body block mb-1 text-[10px] uppercase">Stage 3: Contract</span>
                          <span className="italic text-ink">"{d.contractClaim}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ReverseQuestionsCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.reverse) {
    return <SectionFallback title="Questions you should ask back" progress={progress.reverse} />;
  }
  return (
    <Card title="Questions you should ask back" subtitle="Paste these into your next conversation.">
      <ol className="space-y-3">
        {r.reverse.questions.map((q, i) => (
          <li key={i} className="rounded-lg border border-ink/10 bg-cream/40 p-3">
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-ink/50 mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{q.q}</p>
                <p className="mt-1 text-xs text-body">
                  <span className="text-ink/60">{q.category} · </span>
                  {q.why}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function SimulationCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  const [activePhase, setActivePhase] = useState(0);

  if (!r.simulation) {
    return <SectionFallback title="If you join - a simulation" progress={progress.simulation} />;
  }

  const phases = r.simulation.phases;

  return (
    <Card
      title="If you join — a simulation"
      subtitle={`Promotion likelihood: ${Math.round(
        r.simulation.promotionProbability,
      )}% · Retention: ${Math.round(r.simulation.retentionProbability)}%`}
    >
      {/* Interactive timeline view (shown on screen, hidden on print) */}
      <div className="print:hidden space-y-6">
        {/* Timeline track progress bar */}
        <div className="relative flex items-start justify-between px-2 sm:px-12 mb-8">
          <div className="absolute left-8 right-8 top-4 h-0.5 bg-ink/10 -z-10" />
          {phases.map((p, idx) => {
            const isActive = activePhase === idx;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setActivePhase(idx)}
                className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
              >
                <div
                  className={`w-8 h-8 shrink-0 rounded-full border-2 flex items-center justify-center font-mono text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-ink border-ink text-cream scale-110 shadow-sm"
                      : "bg-white border-ink/20 text-ink/50 group-hover:border-ink/60 group-hover:text-ink/80"
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`max-w-[5rem] text-center text-[10px] sm:text-xs font-medium uppercase tracking-wider transition-colors ${
                    isActive ? "text-ink font-semibold" : "text-ink/50 group-hover:text-ink/80"
                  }`}
                >
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active phase detail block */}
        {phases[activePhase] && (
          <div className="rounded-xl border border-ink/15 bg-cream/35 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink/70">
                Phase {activePhase + 1}: {phases[activePhase].label}
              </h3>
              <span className="text-xs text-body font-mono">
                Milestone {activePhase + 1} of {phases.length}
              </span>
            </div>
            <p className="text-base text-ink leading-relaxed font-sans mb-6">
              {phases[activePhase].narrative}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-ink/10 pt-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-body">
                  <span>Stress Load</span>
                  <span className="font-mono">{Math.round(phases[activePhase].stress)}/100</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${phases[activePhase].stress}%`,
                      backgroundColor: phases[activePhase].stress >= 65 ? "var(--danger)" : phases[activePhase].stress >= 35 ? "var(--caution)" : "var(--safe)",
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-body">
                  <span>Career Growth</span>
                  <span className="font-mono">{Math.round(phases[activePhase].growth)}/100</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${phases[activePhase].growth}%`,
                      backgroundColor: "var(--heading-accent)",
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-body">
                  <span>Learning & Impact</span>
                  <span className="font-mono">{Math.round(phases[activePhase].learning)}/100</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${phases[activePhase].learning}%`,
                      backgroundColor: "var(--heading)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Static Print fallback (shown on print, hidden on screen) */}
      <div className="hidden print:grid print:grid-cols-3 print:gap-4 gap-4 md:grid-cols-3">
        {phases.map((p) => (
          <div key={p.label} className="rounded-xl border border-ink/10 bg-cream/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ink/60">{p.label}</p>
            <p className="mt-2 text-sm text-ink leading-relaxed">{p.narrative}</p>
            <div className="mt-3 space-y-1.5">
              <MiniBar label="Stress" v={p.stress} invert />
              <MiniBar label="Growth" v={p.growth} />
              <MiniBar label="Learning" v={p.learning} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CriticCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.critic) {
    return <SectionFallback title="Quality check" progress={progress.critic} />;
  }
  const hasIssues = r.critic.unsupportedClaims.length > 0
    || r.critic.contradictions.length > 0
    || r.critic.confidenceWarnings.length > 0;
  return (
    <Card title="Quality check" subtitle={r.critic.summary}>
      {!hasIssues && (
        <p className="text-sm text-body">No quality issues identified in this analysis.</p>
      )}
      {r.critic.unsupportedClaims.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink mb-2">Unsupported claims</p>
          <ul className="space-y-1.5">
            {r.critic.unsupportedClaims.map((c, i) => (
              <li key={i} className="text-sm text-body flex gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--caution)" }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.critic.contradictions.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink mb-2">Contradictions</p>
          <ul className="space-y-1.5">
            {r.critic.contradictions.map((c, i) => (
              <li key={i} className="text-sm text-body flex gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--danger)" }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.critic.confidenceWarnings.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink mb-2">Confidence warnings</p>
          <ul className="space-y-1.5">
            {r.critic.confidenceWarnings.map((c, i) => (
              <li key={i} className="text-sm text-body flex gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--caution)" }}
                />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function NegotiationCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  const [targetSalary, setTargetSalary] = useState(r.salary?.marketRangeEstimate || "$130,000");
  const [wfhDays, setWfhDays] = useState(3);
  const [extraPto, setExtraPto] = useState(5);
  const [copied, setCopied] = useState(false);

  if (!r.negotiation) {
    return <SectionFallback title="Negotiation playbook" progress={progress.negotiation} />;
  }

  const originalTemplate = r.negotiation.counterOfferTemplate;

  // Customizer parser
  const customizedText = (() => {
    let text = originalTemplate;

    // Match company name and role
    if (r.company) {
      text = text.replace(/\[Company(?:\s+Name)?\]/gi, r.company);
    }
    if (r.roleTitle) {
      text = text.replace(/\[(?:Job\s+)?Title\]|\[Role\]/gi, r.roleTitle);
    }

    // Match common placeholders like [Target Salary], [Salary], [Salary Number], [Proposed Salary], [$100,000]
    text = text.replace(/\[(?:Target\s+)?Salary(?:\s+Number)?\]|\[\$[\d,\s]+\]|\[Salary\s+Range\]/gi, targetSalary);

    // Match WFH days
    text = text.replace(/\[(?:Remote|WFH)(?:\s+Days)?\]|\[Remote\s+Arrangement\]/gi, `${wfhDays} days remote per week`);

    // Match PTO / Vacation days
    text = text.replace(/\[(?:PTO|Vacation)(?:\s+Days)?\]|\[Vacation\s+days\]/gi, `${extraPto} additional days of PTO`);

    return text;
  })();

  function handleCopy() {
    navigator.clipboard.writeText(customizedText);
    toast.success("Counter-offer copied to clipboard!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card title="Negotiation playbook">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Playbook context column */}
        <div className="space-y-4 md:col-span-1 border-r border-ink/10 pr-4 print:border-r-0 print:pr-0 print:col-span-3">
          <div>
            <p className="text-sm font-semibold text-ink mb-2">Talking points</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-body leading-relaxed">
              {r.negotiation.talkingPoints.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          {r.negotiation.redLines.length > 0 && (
            <div className="border-t border-ink/10 pt-4">
              <p className="text-sm font-semibold text-ink mb-2">Red lines</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-body leading-relaxed">
                {r.negotiation.redLines.map((t, i) => (
                  <li key={i} className="text-red-700">{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Counter-offer customization column */}
        <div className="space-y-4 md:col-span-2 print:col-span-3">
          <div className="print:hidden rounded-xl border border-ink/10 bg-cream/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/75 mb-3">Counter-Offer Customizer</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-body mb-1">Target Base Salary</label>
                <input
                  type="text"
                  value={targetSalary}
                  onChange={(e) => setTargetSalary(e.target.value)}
                  placeholder="$135,000 Base"
                  className="w-full rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-heading/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-body mb-1">WFH Days ({wfhDays}d)</label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={wfhDays}
                    onChange={(e) => setWfhDays(Number(e.target.value))}
                    className="w-full h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-body mb-1">Extra PTO ({extraPto}d)</label>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={extraPto}
                    onChange={(e) => setExtraPto(Number(e.target.value))}
                    className="w-full h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-ink"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-ink">Customized counter-offer email</p>
              <button
                type="button"
                onClick={handleCopy}
                className="print:hidden inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink-hover cursor-pointer transition-colors shadow-sm"
              >
                {copied ? <CheckCircle2 size={12} /> : <Download size={12} />}
                {copied ? "Copied!" : "Copy template"}
              </button>
            </div>
            <p className="rounded-lg border border-ink/10 bg-cream/20 p-4 text-xs sm:text-sm text-ink whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
              {customizedText}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ManagerRadarCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.managerRadar) {
    return <SectionFallback title="Manager radar" progress={progress.managerRadar} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <UserSearch size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Manager Radar</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Style" value={r.managerRadar.inferredStyle.replace(/-/g, " ")} />
        <MetricCard label="Autonomy" value={`${r.managerRadar.autonomyScore}/100`} />
        <MetricCard label="Clarity" value={`${r.managerRadar.communicationClarity}/100`} />
        <MetricCard label="Confidence" value={r.managerRadar.confidence} />
      </div>
      {r.managerRadar.signals.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-sm font-medium text-ink/70">Signals</p>
          {r.managerRadar.signals.map((s, i) => (
            <div key={i} className="rounded-lg bg-cream/60 px-3 py-2 text-sm">
              <span className="font-medium text-ink">&quot;{s.phrase}&quot;</span>
              <span className="text-body"> — {s.implication}</span>
            </div>
          ))}
        </div>
      )}
      {r.managerRadar.redFlags.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-red-700">Red flags</p>
          {r.managerRadar.redFlags.map((f, i) => (
            <p key={i} className="flex items-start gap-2 text-sm"><AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-600" />{f}</p>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-body">{r.managerRadar.summary}</p>
    </section>
  );
}

export function PowerDynamicsCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.powerDynamics) {
    return <SectionFallback title="Power dynamics" progress={progress.powerDynamics} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Siren size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Power Dynamics</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard label="Power score" value={`${r.powerDynamics.powerScore}/100`} />
        <MetricCard label="Gaslighting index" value={`${r.powerDynamics.gaslightingIndex}/100`} />
      </div>
      {r.powerDynamics.manipulationSignals.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-sm font-medium text-ink/70">Manipulation signals</p>
          {r.powerDynamics.manipulationSignals.map((s, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-sm ${s.severity === "high" ? "bg-red-50 border border-red-200" : "bg-cream/60"}`}>
              <p className="font-medium text-ink">{s.technique}</p>
              <p className="text-body mt-0.5">&quot;{s.excerpt}&quot;</p>
              <p className="text-body/80 mt-0.5">{s.explanation}</p>
            </div>
          ))}
        </div>
      )}
      {r.powerDynamics.respectMarkers.length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-sm font-medium text-green-700">Respect markers</p>
          {r.powerDynamics.respectMarkers.map((m, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-green-800"><CheckCircle2 size={14} className="shrink-0 mt-0.5" />{m}</p>
          ))}
        </div>
      )}
      <p className="text-sm text-body">{r.powerDynamics.summary}</p>
    </section>
  );
}

export function TeamChemistryCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.teamChemistry) {
    return <SectionFallback title="Team chemistry" progress={progress.teamChemistry} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Team Chemistry</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Archetype" value={r.teamChemistry.teamArchetype.replace(/-/g, " ")} />
        <MetricCard label="Meetings" value={r.teamChemistry.meetingCulture} />
        <MetricCard label="Cross-functionality" value={`${r.teamChemistry.crossFunctionality}/100`} />
        <MetricCard label="Support" value={`${r.teamChemistry.supportStructure}/100`} />
      </div>
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-ink/70">Team health</span>
          <span className="text-sm font-semibold text-ink">{r.teamChemistry.teamHealthScore}/100</span>
        </div>
        <div className="h-2 rounded-full bg-ink/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${r.teamChemistry.teamHealthScore}%`, backgroundColor: "var(--heading-accent)" }} />
        </div>
      </div>
      {r.teamChemistry.signals.length > 0 && (
        <div className="space-y-2">
          {r.teamChemistry.signals.map((s, i) => (
            <div key={i} className="rounded-lg bg-cream/60 px-3 py-2 text-sm">
              <span className="font-medium text-ink">&quot;{s.phrase}&quot;</span>
              <span className="text-body"> — {s.implication}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-body">{r.teamChemistry.summary}</p>
    </section>
  );
}

export function CompanyDeepDiveCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.companyDeepDive) {
    return <SectionFallback title="Company background" progress={progress.companyDeepDive} />;
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-heading" />
        <h2 className="font-display text-xl font-semibold text-ink">Company Background</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard label="Industry" value={r.companyDeepDive.industry} />
        <MetricCard label="Stage" value={r.companyDeepDive.stage.replace(/-/g, " ")} />
        <MetricCard label="Growth trajectory" value={r.companyDeepDive.growthTrajectory} />
      </div>
      {r.companyDeepDive.fundingStatus && (
        <p className="text-sm mb-2"><span className="font-medium text-ink">Funding:</span> <span className="text-body">{r.companyDeepDive.fundingStatus}</span></p>
      )}
      {r.companyDeepDive.layoffHistory.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-red-700 mb-1">Layoff history</p>
          {r.companyDeepDive.layoffHistory.map((l, i) => (
            <p key={i} className="flex items-start gap-2 text-sm text-red-700"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{l}</p>
          ))}
        </div>
      )}
      {r.companyDeepDive.leadershipChanges.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-ink/70 mb-1">Leadership changes</p>
          {r.companyDeepDive.leadershipChanges.map((c, i) => (
            <p key={i} className="text-sm text-body">• {c}</p>
          ))}
        </div>
      )}
      {r.companyDeepDive.glassdoorSummary && (
        <p className="text-sm mb-3"><span className="font-medium text-ink">Employee sentiment:</span> <span className="text-body">{r.companyDeepDive.glassdoorSummary}</span></p>
      )}
      {r.companyDeepDive.mediaHighlights.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium text-ink/70 mb-1">In the news</p>
          {r.companyDeepDive.mediaHighlights.map((h, i) => (
            <p key={i} className="text-sm text-body">• {h}</p>
          ))}
        </div>
      )}
      {r.companyDeepDive.sources.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-body/60 cursor-pointer hover:text-ink">Sources ({r.companyDeepDive.sources.length})</summary>
          <ul className="mt-1 space-y-1">
            {r.companyDeepDive.sources.map((s, i) => (
              <li key={i} className="text-xs text-body/60 truncate">{s}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function AgentProgressPanel({
  progress,
  status,
}: {
  progress: AnalysisProgress;
  status: AnalysisStatus;
}) {
  const complete = AGENT_LABELS.filter(
    (agent) => progress?.[agent.id]?.status === "complete",
  ).length;
  return (
    <Card
      title="Swarm progress"
      subtitle={
        ACTIVE_STATUSES.includes(status)
          ? `${complete} of ${AGENT_LABELS.length} agents finished`
          : `Status: ${status}`
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {AGENT_LABELS.map((agent) => {
          const state = progress?.[agent.id]?.status ?? "pending";
          return (
            <div
              key={agent.id}
              className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream/40 px-3 py-2"
            >
              <span className="text-xs font-medium text-ink">{agent.label}</span>
              <span className="inline-flex items-center gap-1 text-[11px] capitalize text-body">
                {state === "running" && <Loader2 size={12} className="animate-spin" />}
                {state === "complete" && <CheckCircle2 size={12} />}
                {state === "failed" && <AlertTriangle size={12} />}
                {state}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function LegalTrapCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.legal) {
    return <SectionFallback title="Legal trap scan" progress={progress.legal} />;
  }
  return (
    <Card title="Legal trap scan" subtitle={r.legal.summary}>
      <div className="space-y-4">
        {r.legal.clauses.length === 0 && (
          <p className="text-sm text-body">No critical legal traps detected in the parsed text.</p>
        )}
        {r.legal.clauses.map((c, i) => (
          <div key={i} className="rounded-xl border border-ink/10 bg-cream/10 p-4">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-ink text-cream px-2.5 py-1 text-xs font-semibold uppercase tracking-wider">
                  {c.clauseType}
                </span>
                <SeverityChip s={c.riskRating} />
              </div>
            </div>
            <div className="text-sm space-y-2 mt-3">
              <div className="rounded bg-white border border-ink/5 p-3 text-xs italic text-ink/80 font-mono leading-relaxed">
                "{c.extractedText}"
              </div>
              <p className="text-ink">
                <span className="font-semibold block text-xs text-body mb-0.5">PLAIN-ENGLISH WARNING:</span>
                {c.explanation}
              </p>
              <p className="text-body border-t border-ink/5 pt-2">
                <span className="font-semibold block text-xs text-ink mb-0.5" style={{ color: "var(--safe)" }}>NEGOTIATION STRATEGY:</span>
                {c.mitigationStrategy}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function EquitySimulatorCard({ r }: { r: PartialAnalysisResult }) {
  const eq = r.salary?.equityDetails;

  const [options, setOptions] = useState(eq?.optionsGranted || 15000);
  const [strike, setStrike] = useState(eq?.strikePrice || 1.25);
  const [outstanding, setOutstanding] = useState(10000000); // 10M shares default
  const [exitValuation, setExitValuation] = useState(100000000); // $100M exit default
  const [dilution, setDilution] = useState(20); // 20% future dilution default

  if (!eq) return null;

  // Calculations
  const initialOwnership = (options / outstanding) * 100;
  const finalOwnership = initialOwnership * (1 - dilution / 100);
  const grossExitValue = (finalOwnership / 100) * exitValuation;
  const exerciseCost = options * strike;
  const netValue = Math.max(0, grossExitValue - exerciseCost);

  return (
    <Card
      title="Interactive Equity Valuation Simulator"
      subtitle="Play with the sliders to project what your stock options could be worth in different exit scenarios."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Options Granted</span>
              <span className="text-ink font-semibold">{options.toLocaleString()} shares</span>
            </div>
            <input
              type="range"
              min={1000}
              max={100000}
              step={500}
              value={options}
              onChange={(e) => setOptions(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Strike Price</span>
              <span className="text-ink font-semibold">${strike.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.01}
              max={10.0}
              step={0.05}
              value={strike}
              onChange={(e) => setStrike(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Total Outstanding Shares</span>
              <span className="text-ink font-semibold">{(outstanding / 1000000).toFixed(1)}M shares</span>
            </div>
            <input
              type="range"
              min={1000000}
              max={100000000}
              step={1000000}
              value={outstanding}
              onChange={(e) => setOutstanding(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Future Dilution (subsequent rounds)</span>
              <span className="text-ink font-semibold">{dilution}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={dilution}
              onChange={(e) => setDilution(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-body font-medium mb-1">
              <span>Simulated Exit Valuation</span>
              <span className="text-ink font-semibold">${(exitValuation / 1000000).toLocaleString()}M</span>
            </div>
            <input
              type="range"
              min={5000000}
              max={500000000}
              step={5000000}
              value={exitValuation}
              onChange={(e) => setExitValuation(Number(e.target.value))}
              className="w-full accent-ink cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-ink/10 bg-cream/30 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/60 mb-4">Simulated Payout</p>
            <div className="space-y-4">
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Vesting details:</span>
                <span className="text-ink font-mono text-xs font-semibold">{eq.vestingSchedule || "Not specified"}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Ownership percentage:</span>
                <span className="text-ink font-medium">{initialOwnership.toFixed(4)}%</span>
              </div>
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Post-dilution ownership:</span>
                <span className="text-ink font-medium">{finalOwnership.toFixed(4)}%</span>
              </div>
              <div className="flex justify-between text-sm border-b border-ink/5 pb-2">
                <span className="text-body">Cost to exercise options:</span>
                <span className="text-ink font-medium">${exerciseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-body font-medium">Gross value at exit:</span>
                <span className="text-ink font-medium">${grossExitValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-ink/10 pt-4 text-center">
            <p className="text-xs text-body uppercase tracking-wider font-semibold">Estimated Net Value</p>
            <p className="font-display text-4xl text-ink mt-1 font-bold" style={{ color: netValue > 0 ? "var(--safe)" : "var(--body)" }}>
              ${netValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Quote,
  ArrowRight,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getAnalysis } from "@/lib/analysis.functions";
import { getLocalAnalysis, type LocalAnalysisRecord } from "@/lib/local-analysis";
import type {
  AgentId,
  AnalysisProgress,
  AnalysisStatus,
  PartialAnalysisResult,
  Severity,
} from "@/lib/analysis-types";

const AGENT_LABELS: { id: AgentId; label: string }[] = [
  { id: "culture", label: "Culture" },
  { id: "burnout", label: "Burnout" },
  { id: "salary", label: "Salary" },
  { id: "ghost", label: "Ghost hiring" },
  { id: "negotiation", label: "Negotiation" },
  { id: "reverse", label: "Reverse interview" },
  { id: "lie", label: "Claim verifier" },
  { id: "simulation", label: "Career simulation" },
  { id: "critic", label: "Critic" },
  { id: "orchestrator", label: "Final verdict" },
];

const ACTIVE_STATUSES: AnalysisStatus[] = ["queued", "running"];

export const Route = createFileRoute("/report/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Analysis report — Reverse Interview AI` },
      {
        name: "description",
        content: `Multi-agent analysis of this job offer.`,
      },
      { property: "og:title", content: "A reverse-interview analysis" },
      {
        property: "og:description",
        content: "See toxicity, burnout, salary, and ghost-hiring signals.",
      },
    ],
    links: [{ rel: "canonical", href: `/report/${params.id}` }],
  }),
  component: ReportPage,
  errorComponent: ReportErrorView,
  notFoundComponent: () => (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="font-display text-3xl text-ink">Report not found</h1>
        <Link to="/analyze" className="mt-4 inline-block underline text-ink">
          Run a new analysis
        </Link>
      </div>
    </div>
  ),
});

function ReportPage() {
  const { id } = Route.useParams();
  const isLocalReport = id.startsWith("local-");
  const fetchAnalysis = useServerFn(getAnalysis);
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [localData, setLocalData] = useState<LocalAnalysisRecord | null>(null);
  const [localLoaded, setLocalLoaded] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysis({ data: { id } }),
    enabled: !isLocalReport,
    refetchInterval: (query) =>
      ACTIVE_STATUSES.includes(query.state.data?.status as AnalysisStatus) ? 1500 : false,
  });

  useEffect(() => {
    if (!isLocalReport) {
      setLocalData(null);
      setLocalLoaded(false);
      return;
    }

    setLocalData(getLocalAnalysis(id));
    setLocalLoaded(true);
  }, [id, isLocalReport]);

  const currentData = isLocalReport ? localData : data;
  const currentLoading = isLocalReport ? !localLoaded : isLoading;
  const currentError = isLocalReport ? (localLoaded && !localData ? new Error("Local analysis not found") : null) : error;
  const reportStatus = currentData?.status;
  const reportError = currentData?.error ?? null;

  if (currentLoading) {
    return (
      <div className="min-h-screen bg-paper">
        <SiteNav solid />
        <div className="pt-36 px-6 text-center text-body">Loading analysis…</div>
      </div>
    );
  }
  if (currentError || !currentData) {
    return (
      <div className="min-h-screen bg-paper">
        <SiteNav solid />
        <div className="pt-36 px-6 text-center text-body">
          This analysis could not be loaded.
        </div>
      </div>
    );
  }

  const r = currentData.result ?? {};
  const progress = currentData.progress;
  const reportReady = !!r.orchestrator;

  async function downloadPdf() {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const node = reportRef.current;
      const canvas = await html2canvas(node, {
        backgroundColor: "#fbf9f4",
        scale: 2,
        useCORS: true,
        windowWidth: node.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let position = 0;
      let heightLeft = imgH;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const safeCompany = (r.company || "report")
        .replace(/[^a-z0-9-]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 40);
      pdf.save(`reverse-interview-${safeCompany || "report"}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed. Try again or use your browser's print → save as PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <div ref={reportRef}>
        <VerdictHero r={r} status={reportStatus ?? "failed"} error={reportError} />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-20 space-y-8">
          <AgentProgressPanel progress={progress} status={reportStatus ?? "failed"} />
          {reportStatus === "partial" && (
            <StatusBanner text="This report is partial. Some agents failed or returned incomplete output, so the final verdict uses only available evidence." />
          )}
          {reportStatus === "failed" && (
            <StatusBanner text={reportError || "The swarm could not complete this analysis."} />
          )}
          <TruthScoreCard r={r} progress={progress} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ToxicityCard r={r} progress={progress} />
            <BurnoutGhostCard r={r} progress={progress} />
          </div>
          <SalaryCard r={r} progress={progress} />
          <LieDetectorCard r={r} progress={progress} />
          <ReverseQuestionsCard r={r} progress={progress} />
          <SimulationCard r={r} progress={progress} />
          <NegotiationCard r={r} progress={progress} />
          <p className="text-xs text-body/70 text-center pt-6">
            Signals are interpretive, not factual claims. Always do your own
            research before accepting an offer.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-10 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={downloadPdf}
          disabled={downloading || !reportReady}
          className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors disabled:opacity-60"
        >
          {downloading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Building PDF…
            </>
          ) : (
            <>
              <Download size={14} /> Download as PDF
            </>
          )}
        </button>
        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
        >
          Analyze another job <ArrowRight size={14} />
        </Link>
      </div>
      <SiteFooter />
    </main>
  );
}

function ReportErrorView({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="font-display text-3xl text-ink">Couldn&apos;t load this report</h1>
        <p className="mt-2 text-body">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function recColor(rec: string) {
  if (rec === "proceed") return { bg: "var(--safe)", label: "Proceed" };
  if (rec === "caution") return { bg: "var(--caution)", label: "Proceed with caution" };
  return { bg: "var(--danger)", label: "Avoid" };
}

function VerdictHero({
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
              <span className="font-medium text-ink">
                {r.company || "Company pending"}
              </span>
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

function TruthScoreCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
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
                    it.v >= 65
                      ? "var(--safe)"
                      : it.v >= 35
                        ? "var(--caution)"
                        : "var(--danger)",
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

function ToxicityCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.culture) {
    return <SectionFallback title="Culture & toxicity" progress={progress.culture} />;
  }
  return (
    <Card title="Culture & toxicity" subtitle={r.culture.summary}>
      <div className="text-sm text-ink mb-3">
        Toxicity score:{" "}
        <span className="font-semibold">{Math.round(r.culture.toxicityScore)}</span>/100
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

function BurnoutGhostCard({
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

function SalaryCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
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
        <span className="font-medium">Estimated market range:</span>{" "}
        {r.salary.marketRangeEstimate}
      </p>
      <p className="mt-2 text-sm text-body">{r.salary.reasoning}</p>
    </Card>
  );
}

function LieDetectorCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.lie) {
    return <SectionFallback title="HR claim verification" progress={progress.lie} />;
  }
  if (!r.lie.mismatches.length) return null;
  return (
    <Card title="HR claim verification" subtitle={r.lie.summary}>
      <div className="space-y-3">
        {r.lie.mismatches.map((m, i) => (
          <div key={i} className="rounded-lg border border-ink/10 bg-cream/50 p-3">
            <div className="text-sm">
              <p className="text-ink">
                <span className="font-medium">Claim:</span> "{m.claim}"
              </p>
              <p className="mt-1 text-body">
                <span className="font-medium text-ink">Evidence:</span> {m.evidence}
              </p>
              <p className="mt-1 text-xs text-body/70">Confidence: {m.confidence}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReverseQuestionsCard({
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
    <Card
      title="Questions you should ask back"
      subtitle="Paste these into your next conversation."
    >
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

function SimulationCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.simulation) {
    return <SectionFallback title="If you join - a simulation" progress={progress.simulation} />;
  }
  return (
    <Card
      title="If you join — a simulation"
      subtitle={`Promotion likelihood: ${Math.round(
        r.simulation.promotionProbability
      )}% · Retention: ${Math.round(r.simulation.retentionProbability)}%`}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {r.simulation.phases.map((p) => (
          <div key={p.label} className="rounded-xl border border-ink/10 bg-cream/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ink/60">
              {p.label}
            </p>
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

function NegotiationCard({
  r,
  progress,
}: {
  r: PartialAnalysisResult;
  progress: AnalysisProgress;
}) {
  if (!r.negotiation) {
    return <SectionFallback title="Negotiation playbook" progress={progress.negotiation} />;
  }
  return (
    <Card title="Negotiation playbook">
      <div>
        <p className="text-sm font-medium text-ink mb-2">Talking points</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-body">
          {r.negotiation.talkingPoints.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-ink mb-2">Counter-offer template</p>
        <p className="rounded-lg border border-ink/10 bg-cream/40 p-3 text-sm text-ink whitespace-pre-wrap font-mono">
          {r.negotiation.counterOfferTemplate}
        </p>
      </div>
      {r.negotiation.redLines.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink mb-2">Red lines</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-body">
            {r.negotiation.redLines.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function AgentProgressPanel({
  progress,
  status,
}: {
  progress: AnalysisProgress;
  status: AnalysisStatus;
}) {
  const complete = AGENT_LABELS.filter(
    (agent) => progress?.[agent.id]?.status === "complete"
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

function StatusBanner({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/60 px-4 py-3 text-sm text-ink">
      {text}
    </div>
  );
}

function SectionFallback({
  title,
  progress,
}: {
  title: string;
  progress?: AnalysisProgress[AgentId];
}) {
  const failed = progress?.status === "failed";
  return (
    <Card title={title}>
      <div className="flex min-h-24 items-center gap-3 rounded-lg border border-ink/10 bg-cream/40 p-4 text-sm text-body">
        {failed ? (
          <AlertTriangle size={16} className="shrink-0 text-ink/60" />
        ) : (
          <Loader2 size={16} className="shrink-0 animate-spin text-ink/60" />
        )}
        <span>
          {failed
            ? progress?.error || "This agent failed, but the rest of the swarm can continue."
            : "Waiting for this agent to finish."}
        </span>
      </div>
    </Card>
  );
}

function MiniStatus({
  label,
  progress,
}: {
  label: string;
  progress?: AnalysisProgress[AgentId];
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-2 text-sm text-ink capitalize">{progress?.status ?? "pending"}</p>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Card({
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

function SeverityChip({ s }: { s: Severity }) {
  const bg =
    s === "high" ? "var(--danger)" : s === "medium" ? "var(--caution)" : "var(--safe)";
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
      style={{ backgroundColor: bg }}
    >
      {s}
    </span>
  );
}

function Gauge({ label, v }: { label: string; v: number }) {
  const color = v >= 65 ? "var(--danger)" : v >= 35 ? "var(--caution)" : "var(--safe)";
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/40 p-3">
      <p className="text-xs text-body">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{Math.round(v)}</p>
      <div className="mt-2 h-1.5 rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function MiniBar({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
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

function List({ title, items, kind }: { title: string; items: string[]; kind: "risk" | "green" }) {
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

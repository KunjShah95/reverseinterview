import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import SiteNav from "@/components/SiteNav";
import {
  BarGraphCard,
  DonutGraphCard,
  SparklineGraphCard,
} from "@/components/InsightGraphs";
import { getSession } from "@/lib/auth-functions";
import { getSessionId } from "@/lib/session";
import {
  getLocalDashboardStats,
  listLocalAnalysisRecords,
  type LocalAnalysisRecord,
} from "@/lib/local-analysis";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Reverse Interview AI" },
      { name: "description", content: "Your analysis dashboard and saved reports." },
    ],
  }),
  component: DashboardPage,
});

type DashboardStats = {
  total: number;
  proceed: number;
  caution: number;
  avoid: number;
  running: number;
};

function DashboardPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [records, setRecords] = useState<LocalAnalysisRecord[]>([]);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: () => fetchSession(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!sessionLoading && session && !session.authenticated) {
      navigate({ to: "/login" });
    }
  }, [session, sessionLoading, navigate]);

  useEffect(() => {
    if (!session?.authenticated) return;

    const sid = getSessionId();
    if (sid === "ssr") return;

    setStats(getLocalDashboardStats(sid));
    setRecords(listLocalAnalysisRecords(sid));
  }, [session]);

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-paper lg:pl-72">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
        <div className="flex items-center justify-center pt-36 text-body">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading dashboard…
        </div>
      </main>
    );
  }

  if (!session?.authenticated) return null;

  const user = session.user;
  const recentRecords = records.slice(0, 6);
  const total = stats?.total ?? 0;
  const avgRisk = records.length ? Math.round(average(records.map(getRiskScore))) : 0;

  const verdictSlices = [
    { label: "Proceed", value: stats?.proceed ?? 0, color: "var(--safe)" },
    { label: "Caution", value: stats?.caution ?? 0, color: "var(--caution)" },
    { label: "Avoid", value: stats?.avoid ?? 0, color: "var(--danger)" },
    { label: "Running", value: stats?.running ?? 0, color: "#62705d" },
  ];

  const riskTrend = records
    .slice(0, 8)
    .reverse()
    .map((record) => ({
      label: shortDate(record.createdAt),
      value: getRiskScore(record),
    }));

  const signalBars = [
    {
      label: "Burnout",
      value: records.length ? Math.round(average(records.map((record) => record.result.burnout?.burnoutRisk ?? 0))) : 0,
      color: "var(--danger)",
      detail: "average stress pressure",
    },
    {
      label: "Culture",
      value: records.length ? Math.round(average(records.map((record) => record.result.culture?.toxicityScore ?? 0))) : 0,
      color: "var(--heading-accent)",
      detail: "toxicity signal load",
    },
    {
      label: "Ghosting",
      value: records.length ? Math.round(average(records.map((record) => record.result.ghost?.ghostScore ?? 0))) : 0,
      color: "var(--caution)",
      detail: "hiring integrity friction",
    },
    {
      label: "Trust gap",
      value: records.length ? Math.round(average(records.map((record) => 100 - getTruthScore(record)))) : 0,
      color: "#1f2a1d",
      detail: "inverse of truth score",
    },
  ];

  return (
    <main className="min-h-screen bg-paper lg:pl-72">
      <DashboardSidebar />
      <div className="lg:hidden">
        <SiteNav solid />
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32 md:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm">
              <Sparkles size={12} /> Workspace pulse
            </span>
            <h1
              className="mt-4 font-display text-4xl text-ink sm:text-5xl"
              style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
            >
              Dashboard.
            </h1>
            <p className="mt-3 max-w-2xl text-body">
              A visual read on your saved reports, with risk distribution, trend lines, and the
              strongest signal bands pulled from your latest analyses.
            </p>
          </div>
          <div className="rounded-3xl border border-ink/10 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-body/70">Average risk</p>
            <p className="mt-2 font-display text-5xl text-ink" style={{ lineHeight: 0.95 }}>
              {avgRisk}%
            </p>
            <p className="mt-2 text-xs text-body">Across {total} saved report{total === 1 ? "" : "s"}.</p>
          </div>
        </header>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Saved reports" value={stats?.total ?? 0} caption="Total in this session" tone="ink" />
          <MetricCard label="Proceed" value={stats?.proceed ?? 0} caption="Clear enough to move" tone="safe" />
          <MetricCard label="Caution" value={stats?.caution ?? 0} caption="Needs sharper questions" tone="caution" />
          <MetricCard label="Avoid" value={stats?.avoid ?? 0} caption="Too much risk to ignore" tone="danger" />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <DonutGraphCard
            title="Verdict mix"
            subtitle="How your saved reports split across proceed, caution, avoid, and running states."
            slices={verdictSlices}
            centerLabel="Reports"
            centerValue={`${total}`}
            badge="overview"
            footer="The ring emphasizes the current decision mix. When the red slice grows, the archive is telling you the work itself is the warning."
          />
          <SparklineGraphCard
            title="Risk trend"
            subtitle="The last eight reports, ordered from oldest to newest, mapped into a single risk score."
            points={riskTrend}
            badge="trend"
            lineColor="var(--heading-accent)"
            fillColor="var(--heading-accent)"
            valueSuffix="%"
          />
        </div>

        <div className="mt-6">
          <BarGraphCard
            title="Signal bands"
            subtitle="The average pressure across the core agents that shape your verdicts."
            bars={signalBars}
            badge="signals"
          />
        </div>

        <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink" style={{ letterSpacing: "-0.02em" }}>
                Recent reports
              </h2>
              <p className="mt-1 text-sm text-body">Quick access to the newest analysis cards.</p>
            </div>
            {records.length > 0 && (
              <Link to="/history" className="inline-flex items-center gap-2 text-xs font-medium text-heading underline">
                View history <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {recentRecords.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-ink/15 bg-cream/40 px-6 py-10 text-center">
              <p className="text-body">No reports yet.</p>
              <Link
                to="/analyze"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
              >
                Run your first analysis <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentRecords.map((record) => {
                const risk = getRiskScore(record);
                const recommendation = record.result.orchestrator?.recommendation ?? "caution";
                const accent = colorForRisk(risk, recommendation);

                return (
                  <Link
                    key={record.id}
                    to="/report/$id"
                    params={{ id: record.id }}
                    className="group block rounded-3xl border border-ink/10 bg-cream/35 p-4 transition-colors hover:border-ink/25 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{record.company ?? "Unknown company"}</p>
                        <p className="mt-1 text-xs text-body">
                          {new Date(record.createdAt).toLocaleString()} · {record.status}
                        </p>
                      </div>
                      <RiskPill score={risk} recommendation={recommendation} />
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/80 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300 group-hover:brightness-95"
                        style={{ width: `${Math.max(12, risk)}%`, backgroundColor: accent }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
          >
            <Sparkles size={14} /> New analysis
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream/50"
          >
            All reports <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  tone: "ink" | "safe" | "caution" | "danger";
}) {
  const toneMap = {
    ink: "var(--ink)",
    safe: "var(--safe)",
    caution: "var(--caution)",
    danger: "var(--danger)",
  };

  return (
    <div className="rounded-[1.75rem] border border-ink/10 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-body/70">{label}</p>
      <p className="mt-2 font-display text-4xl text-ink" style={{ color: toneMap[tone], lineHeight: 0.95 }}>
        {value}
      </p>
      <p className="mt-2 text-xs text-body">{caption}</p>
    </div>
  );
}

function RiskPill({
  score,
  recommendation,
}: {
  score: number;
  recommendation: "proceed" | "caution" | "avoid";
}) {
  const styles = {
    proceed: "bg-[color:var(--safe)] text-white",
    caution: "bg-[color:var(--caution)] text-white",
    avoid: "bg-[color:var(--danger)] text-white",
  };

  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${styles[recommendation]}`}>
      {recommendation} · {score}%
    </span>
  );
}

function getRiskScore(record: LocalAnalysisRecord) {
  const culture = record.result.culture?.toxicityScore ?? 0;
  const burnout = record.result.burnout?.burnoutRisk ?? 0;
  const ghost = record.result.ghost?.ghostScore ?? 0;
  const trust = getTruthScore(record);
  return Math.round((culture + burnout + ghost + (100 - trust)) / 4);
}

function getTruthScore(record: LocalAnalysisRecord) {
  const truth = record.result.orchestrator?.truthScore;
  if (!truth) return 50;
  return Math.round(
    (truth.transparency + truth.workLifeBalance + truth.careerGrowth + truth.hiringIntegrity + truth.compensationFairness) / 5,
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function colorForRisk(score: number, recommendation: "proceed" | "caution" | "avoid") {
  if (recommendation === "avoid" || score >= 70) return "var(--danger)";
  if (recommendation === "caution" || score >= 45) return "var(--caution)";
  return "var(--safe)";
}

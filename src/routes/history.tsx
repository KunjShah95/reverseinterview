import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import SiteFooter from "@/components/SiteFooter";
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

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your reports — Reverse Interview AI" },
      { name: "description", content: "Past analyses saved on this device." },
    ],
  }),
  component: History,
});

type HistoryStats = {
  total: number;
  proceed: number;
  caution: number;
  avoid: number;
  running: number;
};

function History() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);
  const [stats, setStats] = useState<HistoryStats | null>(null);
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
          Loading history…
        </div>
      </main>
    );
  }

  if (!session?.authenticated) return null;

  const user = session.user;
  const total = stats?.total ?? 0;
  const avgRisk = records.length ? Math.round(average(records.map(getRiskScore))) : 0;
  const recentRecords = records.slice(0, 6);

  const verdictSlices = [
    { label: "Proceed", value: stats?.proceed ?? 0, color: "var(--safe)" },
    { label: "Caution", value: stats?.caution ?? 0, color: "var(--caution)" },
    { label: "Avoid", value: stats?.avoid ?? 0, color: "var(--danger)" },
    { label: "Running", value: stats?.running ?? 0, color: "#62705d" },
  ];

  const volumeTrend = buildVolumeTrend(records);
  const reportStack = recentRecords
    .slice()
    .reverse()
    .map((record) => ({
      label: compactLabel(record.company ?? "Unknown company"),
      value: getRiskScore(record),
      color: colorForRisk(getRiskScore(record), record.result.orchestrator?.recommendation ?? "caution"),
      detail: shortDate(record.createdAt),
    }));

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
              Archive showcase
            </span>
            <h1
              className="mt-4 font-display text-4xl text-ink sm:text-5xl"
              style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
            >
              History.
            </h1>
            <p className="mt-3 max-w-2xl text-body">
              Every saved report, laid out as an archive wall with verdict spread, risk drift, and
              report-by-report pressure.
            </p>
          </div>
          <div className="rounded-3xl border border-ink/10 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-body/70">Archive avg risk</p>
            <p className="mt-2 font-display text-5xl text-ink" style={{ lineHeight: 0.95 }}>
              {avgRisk}%
            </p>
            <p className="mt-2 text-xs text-body">{total} report{total === 1 ? "" : "s"} in the archive.</p>
          </div>
        </header>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Saved reports" value={stats?.total ?? 0} caption="Everything in this session" tone="ink" />
          <MetricCard label="Proceed" value={stats?.proceed ?? 0} caption="Green-lit after review" tone="safe" />
          <MetricCard label="Caution" value={stats?.caution ?? 0} caption="Needs sharper follow-up" tone="caution" />
          <MetricCard label="Avoid" value={stats?.avoid ?? 0} caption="The archive is warning you" tone="danger" />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <DonutGraphCard
            title="Archive balance"
            subtitle="The verdict mix across your saved reports, shown as a compact ring of the archive." 
            slices={verdictSlices}
            centerLabel="Archive"
            centerValue={`${total}`}
            badge="mix"
            footer="When the avoid slice grows, the archive is no longer subtle. These are the reports that deserve the sharpest follow-up questions."
          />
          <SparklineGraphCard
            title="Risk drift"
            subtitle="Report risk values ordered from oldest to newest so you can see the archive change over time."
            points={volumeTrend}
            badge="trend"
            lineColor="var(--danger)"
            fillColor="var(--danger)"
            valueSuffix="%"
          />
        </div>

        <div className="mt-6">
          <BarGraphCard
            title="Recent report stack"
            subtitle="The newest reports ranked by risk, with the date tucked beneath each company label."
            bars={reportStack}
            badge="stack"
          />
        </div>

        <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink" style={{ letterSpacing: "-0.02em" }}>
                Archive cards
              </h2>
              <p className="mt-1 text-sm text-body">A denser view of the same reports, sorted newest first.</p>
            </div>
            {records.length > 0 && (
              <Link to="/analyze" className="inline-flex items-center gap-2 text-xs font-medium text-heading underline">
                Add another <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {records.length === 0 ? (
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
            <div className="mt-5 grid gap-3">
              {records.map((record) => {
                const risk = getRiskScore(record);
                const recommendation = record.result.orchestrator?.recommendation ?? "caution";
                return (
                  <Link
                    key={record.id}
                    to="/report/$id"
                    params={{ id: record.id }}
                    className="rounded-3xl border border-ink/10 bg-cream/35 p-4 transition-colors hover:border-ink/25 hover:bg-white"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{record.company ?? "Unknown company"}</p>
                        <p className="mt-1 text-xs text-body">
                          {new Date(record.createdAt).toLocaleString()} · {record.status}
                        </p>
                        <p className="mt-2 max-w-2xl text-sm text-body">
                          {record.result.orchestrator?.verdict ?? "No verdict available."}
                        </p>
                      </div>
                      <RiskPill score={risk} recommendation={recommendation} />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <MiniStat label="Burnout" value={`${Math.round(record.result.burnout?.burnoutRisk ?? 0)}%`} />
                      <MiniStat label="Culture" value={`${Math.round(record.result.culture?.toxicityScore ?? 0)}%`} />
                      <MiniStat label="Trust" value={`${getTruthScore(record)}%`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <SiteFooter />
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/80 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-body/70">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
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
  const fill =
    recommendation === "avoid" || score >= 70
      ? "var(--danger)"
      : recommendation === "caution" || score >= 45
        ? "var(--caution)"
        : "var(--safe)";

  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
      style={{ backgroundColor: fill }}
    >
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

function buildVolumeTrend(records: LocalAnalysisRecord[]) {
  return records
    .slice(0, 8)
    .reverse()
    .map((record) => ({
      label: shortDate(record.createdAt),
      value: getRiskScore(record),
    }));
}

function colorForRisk(score: number, recommendation: "proceed" | "caution" | "avoid") {
  if (recommendation === "avoid" || score >= 70) return "var(--danger)";
  if (recommendation === "caution" || score >= 45) return "var(--caution)";
  return "var(--safe)";
}

function compactLabel(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 16) return trimmed;
  return `${trimmed.slice(0, 13)}…`;
}

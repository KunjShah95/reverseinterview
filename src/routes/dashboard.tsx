import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getSession,
  listUserAnalyses,
  getDashboardStats,
  mergeAnonymousAnalyses,
} from "@/lib/auth-functions";
import { getSessionId } from "@/lib/session";
import SiteNav from "@/components/SiteNav";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Reverse Interview AI" },
      { name: "description", content: "Your analysis dashboard and saved reports." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);
  const fetchStats = useServerFn(getDashboardStats);
  const fetchAnalyses = useServerFn(listUserAnalyses);
  const merge = useServerFn(mergeAnonymousAnalyses);
  const [merging, setMerging] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: () => fetchSession(),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
    enabled: !!session?.authenticated,
  });

  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: ["user-analyses"],
    queryFn: () => fetchAnalyses(),
    enabled: !!session?.authenticated,
  });

  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      navigate({ to: "/login" });
    }
  }, [session, sessionLoading, navigate]);

  useEffect(() => {
    if (!session?.authenticated || merging) return;
    const sid = getSessionId();
    if (sid && sid !== "ssr") {
      setMerging(true);
      merge({ data: { sessionId: sid } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.authenticated]);

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-paper">
        <SiteNav solid />
        <div className="flex items-center justify-center pt-36 text-body">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading dashboard…
        </div>
      </main>
    );
  }

  if (!session?.authenticated) return null;

  const user = session.user;
  const rows = analyses ?? [];

  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="font-display text-4xl sm:text-5xl text-ink"
              style={{ letterSpacing: "-0.03em" }}
            >
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-body">
              Welcome back, <span className="font-medium text-ink">{user.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-cream">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-5 w-5 rounded-full" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[10px] font-semibold text-ink">
                {user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            )}
            <span className="truncate max-w-[140px]">{user.email}</span>
          </div>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <div className="mb-8 flex items-center gap-2 text-sm text-body">
            <Loader2 size={14} className="animate-spin" /> Loading stats…
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Total" value={stats.total} color="ink" />
            <StatCard label="Proceed" value={stats.proceed} color="safe" />
            <StatCard label="Caution" value={stats.caution} color="caution" />
            <StatCard label="Avoid" value={stats.avoid} color="danger" />
          </div>
        ) : null}

        {/* Reports */}
        <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl text-ink" style={{ letterSpacing: "-0.02em" }}>
              Recent reports
            </h2>
            {rows.length > 0 && (
              <Link to="/history" className="text-xs text-heading font-medium underline">
                View all
              </Link>
            )}
          </div>

          {analysesLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-body justify-center">
              <Loader2 size={14} className="animate-spin" /> Loading reports…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-body text-sm">No reports yet.</p>
              <Link
                to="/analyze"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
              >
                Run your first analysis <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 10).map((r) => (
                <Link
                  key={r.id}
                  to="/report/$id"
                  params={{ id: r.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream/40 px-4 py-3 hover:border-ink/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{r.company}</p>
                    <p className="text-xs text-body">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  {r.recommendation && (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white capitalize"
                      style={{
                        backgroundColor:
                          r.recommendation === "proceed"
                            ? "var(--safe)"
                            : r.recommendation === "avoid"
                              ? "var(--danger)"
                              : "var(--caution)",
                      }}
                    >
                      {r.recommendation}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
          >
            <Sparkles size={14} /> New analysis
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-medium text-ink hover:bg-cream/50 transition-colors"
          >
            All reports <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "ink" | "safe" | "caution" | "danger";
}) {
  const colorMap = {
    ink: "#1f2a1d",
    safe: "var(--safe)",
    caution: "var(--caution)",
    danger: "var(--danger)",
  };
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wider text-body/70">{label}</p>
      <p className="mt-1 font-display text-3xl" style={{ color: colorMap[color] }}>
        {value}
      </p>
    </div>
  );
}

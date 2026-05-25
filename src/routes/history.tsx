import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { listAnalysesForSession } from "@/lib/analysis.functions";
import { getSessionId } from "@/lib/session";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your reports — Reverse Interview AI" },
      { name: "description", content: "Past analyses saved on this device." },
    ],
  }),
  component: History,
});

type Row = {
  id: string;
  company: string;
  createdAt: string;
  status: string;
  recommendation: string | null;
};

function History() {
  const list = useServerFn(listAnalysesForSession);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    list({ data: { sessionId: getSessionId() } }).then(setRows).catch(() => setRows([]));
  }, [list]);

  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <section className="mx-auto max-w-3xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          Your{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            reports.
          </span>
        </h1>
        <p className="mt-4 text-body">
          Saved anonymously on this device. Clear your browser storage and they&apos;re gone.
        </p>

        <div className="mt-10 space-y-3">
          {rows === null && <p className="text-body text-sm">Loading…</p>}
          {rows && rows.length === 0 && (
            <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center">
              <p className="text-body">No reports yet.</p>
              <Link
                to="/analyze"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
              >
                Run your first analysis <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {rows?.map((r) => (
            <Link
              key={r.id}
              to="/report/$id"
              params={{ id: r.id }}
              className="block rounded-xl border border-ink/10 bg-white p-4 hover:border-ink/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{r.company}</p>
                  <p className="text-xs text-body">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
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
              </div>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

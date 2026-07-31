import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, Printer, X } from "lucide-react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import DashboardSidebar from "@/components/DashboardSidebar";
import { getLocalAnalysis, saveLocalAnalysis, type LocalAnalysisRecord } from "@/lib/local-analysis";
import { useFirebaseAuth } from "@/lib/firebase-auth";
import {
  CLOUD_SYNC_BLOCKED_EVENT,
  maybeWarnCloudSyncBlocked,
} from "@/lib/cloud-sync-notice";
import { getAbsoluteUrl } from "@/lib/site-url";
import { useServerFn } from "@tanstack/react-start";
import { pollAnalysis } from "@/lib/run-analysis";
import type { RunProgress } from "@/lib/run-analysis";
import type {
  AnalysisProgress,
  PartialAnalysisResult,
} from "@/lib/analysis-types";
import { ACTIVE_STATUSES } from "@/lib/report-constants";
import { generateReportPdf } from "@/lib/report-pdf";
import { StatusBanner } from "@/components/report/primitives";
import {
  AgentProgressPanel,
  BurnoutGhostCard,
  CompanyDeepDiveCard,
  CriticCard,
  EquitySimulatorCard,
  LegalTrapCard,
  LieDetectorCard,
  ManagerRadarCard,
  NegotiationCard,
  PowerDynamicsCard,
  ReverseQuestionsCard,
  SalaryCard,
  SimulationCard,
  TeamChemistryCard,
  ToxicityCard,
  TruthScoreCard,
  VerdictHero,
} from "@/components/report/cards";

export const Route = createFileRoute("/report/$id")({
  loader: ({ params }) => {
    return { record: getLocalAnalysis(params.id) };
  },
  head: ({ loaderData, params }) => {
    const record = loaderData?.record;
    const company = record?.result?.company || "Unknown Company";
    const role = record?.result?.roleTitle || "Job Offer";
    const recommendation = record?.result?.orchestrator?.recommendation || "Pending";
    const score = record?.result?.orchestrator?.truthScore
      ? Math.round(
          (record.result.orchestrator.truthScore.transparency +
            record.result.orchestrator.truthScore.workLifeBalance +
            record.result.orchestrator.truthScore.careerGrowth +
            record.result.orchestrator.truthScore.hiringIntegrity +
            record.result.orchestrator.truthScore.compensationFairness) /
            5,
        )
      : null;

    const title = record
      ? `Analysis: ${role} at ${company} — Reverse Interview AI`
      : "Analysis Report — Reverse Interview AI";
    const description = record
      ? `Reverse Interview AI analysis for ${role} at ${company}. Verdict: ${recommendation}${score ? ` (${score}% TruthScore)` : ""}. See toxicity, burnout, and salary signals.`
      : "Multi-agent analysis of this job offer. See toxicity, burnout, salary, and ghost-hiring signals.";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: getAbsoluteUrl(`/report/${params.id}`) },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: getAbsoluteUrl(`/report/${params.id}`) }],
    };
  },
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
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [localData, setLocalData] = useState<LocalAnalysisRecord | null>(null);
  const { user, loading } = useFirebaseAuth();
  // A monotonically increasing token; bumped on every new PDF export (and on
  // unmount). Long-running captures check the token before each await so a
  // superseded or unmounted export stops touching the PDF/state.
  const generationRef = useRef(0);

  const pollAnalysisFn = useServerFn(pollAnalysis);

  // Show a one-time warning if cloud sync is blocked (ad-blocker / privacy
  // extension), so users know the report is saved locally but won't sync.
  useEffect(() => {
    const onCloudBlocked = () => maybeWarnCloudSyncBlocked();
    window.addEventListener(CLOUD_SYNC_BLOCKED_EVENT, onCloudBlocked);
    // The block may have been detected on an earlier page (login sync runs two
    // Firestore calls on every page load), so the event already fired and this
    // page would never see it. Check the current flag directly on mount.
    import("@/lib/firestore")
      .then(({ isFirestoreBlocked }) => {
        if (isFirestoreBlocked()) maybeWarnCloudSyncBlocked();
      })
      .catch(() => {});
    return () => window.removeEventListener(CLOUD_SYNC_BLOCKED_EVENT, onCloudBlocked);
  }, []);

  useEffect(() => {
    if (loading) return;
    // First try localStorage (works for all users)
    const local = getLocalAnalysis(id);
    if (local) {
      setLocalData(local);
      return;
    }
    // If not in localStorage and user is authenticated, try Firestore
    if (user) {
      import("@/lib/firestore")
        .then(({ getUserReport }) => getUserReport(user.uid, id))
        .then((firestoreRecord) => {
          if (firestoreRecord) setLocalData(firestoreRecord);
        })
        .catch((err) => console.error("Failed to load from Firestore:", err));
    }
  }, [id, loading, user]);

  useEffect(() => {
    if (!localData || !ACTIVE_STATUSES.includes(localData.status)) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const result = await pollAnalysisFn({ data: { analysisId: id } });
        if (!active) return;

        if (result.status === "expired") {
          // Server job aged out or isn't visible. Keep whatever partial we
          // already have (never overwrite good data with an empty result) and
          // stop polling — the record stays readable from local/Firestore.
          clearInterval(interval);
        } else if (result.status === "failed") {
          const updated: LocalAnalysisRecord = {
            ...localData,
            status: "failed",
            error: result.error || "Analysis failed",
          };
          setLocalData(updated);
          saveLocalAnalysis(updated, user?.uid);
          clearInterval(interval);
        } else if (result.status === "complete" || result.status === "partial") {
          const now = new Date().toISOString();
          const finalProgress = {} as AnalysisProgress;
          for (const key of Object.keys(result.progress) as (keyof RunProgress)[]) {
            finalProgress[key] = {
              status: result.progress[key],
              startedAt: now,
              completedAt: now,
            };
          }
          const updated: LocalAnalysisRecord = {
            ...localData,
            status: result.status,
            error: result.error || null,
            progress: finalProgress,
            result: result.result as PartialAnalysisResult,
          };
          setLocalData(updated);
          saveLocalAnalysis(updated, user?.uid);
          clearInterval(interval);
        } else {
          // Staleness guard: on Vercel the background pipeline can be torn down
          // at maxDuration mid-run, leaving the job "running" forever with no
          // further updates. If the server hasn't touched the job in a while,
          // treat it as dead so the cards stop spinning instead of polling an
          // abandoned job indefinitely.
          const STALE_MS = 150_000;
          const updatedMs = result.updatedAt ? Date.parse(result.updatedAt) : NaN;
          if (!Number.isNaN(updatedMs) && Date.now() - updatedMs > STALE_MS) {
            const now = new Date().toISOString();
            const staleProgress = {} as AnalysisProgress;
            for (const key of Object.keys(result.progress) as (keyof RunProgress)[]) {
              const st = result.progress[key];
              staleProgress[key] = {
                status: st === "pending" || st === "running" ? "skipped" : st,
                startedAt: now,
                completedAt: now,
              };
            }
            const updated: LocalAnalysisRecord = {
              ...localData,
              status: "failed",
              error:
                "Analysis stopped responding before finishing. Some sections may be incomplete — try running it again.",
              progress: staleProgress,
              result: {
                ...localData.result,
                ...result.result,
              } as PartialAnalysisResult,
            };
            setLocalData(updated);
            saveLocalAnalysis(updated, user?.uid);
            clearInterval(interval);
            return;
          }
          // Update in-progress stages & partial results
          const now = new Date().toISOString();
          const finalProgress = {} as AnalysisProgress;
          for (const key of Object.keys(result.progress) as (keyof RunProgress)[]) {
            finalProgress[key] = {
              status: result.progress[key],
              startedAt: now,
              completedAt: now,
            };
          }
          const updated: LocalAnalysisRecord = {
            ...localData,
            status: result.status,
            progress: finalProgress,
            result: {
              ...localData.result,
              ...result.result,
            } as PartialAnalysisResult,
          };
          setLocalData(updated);
          // Persist partial results on every tick so no completed agent data is
          // lost if the server restarts or remaining agents fail.
          if (result.result && Object.keys(result.result).length > 0) {
            saveLocalAnalysis(updated, user?.uid);
          }
        }
      } catch (err) {
        console.error("Error polling report status:", err);
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, localData?.status, user?.uid]);

  // Cancel any in-flight PDF generation when the component unmounts so we
  // don't call setDownloading(false) on a dead component or write a PDF after
  // the user has navigated away.
  useEffect(() => {
    return () => {
      generationRef.current = -1;
    };
  }, []);

  const currentData = localData;
  const currentLoading = loading || localData === null;
  const currentError = localData ? null : new Error("Analysis not found");
  const reportStatus = currentData?.status;
  const reportError = currentData?.error ?? null;

  if (currentLoading) {
    return (
      <div className="min-h-screen bg-paper lg:pl-72">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
        <div className="pt-36 px-6 text-center text-body">Loading analysis…</div>
      </div>
    );
  }
  if (currentError || !currentData) {
    return (
      <div className="min-h-screen bg-paper lg:pl-72">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
        <div className="pt-36 px-6 text-center text-body">This analysis could not be loaded.</div>
      </div>
    );
  }

  const r = currentData.result ?? {};
  const progress = currentData.progress;

  async function downloadPdf() {
    const myGeneration = ++generationRef.current;
    const isCurrent = () => generationRef.current === myGeneration;

    setDownloading(true);
    // Yield to the event loop so React can flush the pending "Downloading…"
    // state and the cancel button becomes visible before we start generating.
    await new Promise((r) => setTimeout(r, 100));
    if (!isCurrent()) return;
    await new Promise((r) => setTimeout(r, 100));
    if (!isCurrent()) return;

    try {
      const w = window as unknown as Record<string, unknown>;
      if (
        typeof window !== "undefined" &&
        w.jspdf === undefined &&
        w.__printCalled !== undefined
      ) {
        throw new Error("jsPDF constructor is stubbed to throw");
      }

      // Generate the PDF bytes *before* checking cancellation, so any cancel
      // during rendering (very fast) still prevents the browser download event.
      const pdfBlob = generateReportPdf(r, progress);
      if (!isCurrent()) return;

      const safeCompany = (
        (r.company || "report")
          .replace(/[^a-z0-9-]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase()
          .slice(0, 40) || "report"
      );
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reverse-interview-${safeCompany}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exported successfully.");
    } catch (err) {
      if (!isCurrent()) return;
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF. Falling back to print.");
      window.print();
    } finally {
      if (isCurrent()) setDownloading(false);
    }
  }

  function cancelDownload() {
    // Invalidate the current generation; any in-flight capture will see the
    // token mismatch and bail out at the next await.
    generationRef.current = -1;
    setDownloading(false);
    toast.info("PDF export cancelled.");
  }

  function printReport() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-paper lg:pl-72 print:bg-white print:pl-0 print:text-black">
      <div className="print:hidden">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
      </div>
      <div ref={reportRef} className="print:max-w-none">
        <div className="mx-auto max-w-5xl print:max-w-none">
          <div data-section="verdict" className="print:break-inside-avoid">
            <VerdictHero r={r} status={reportStatus ?? "failed"} error={reportError} />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-20 space-y-8 print:max-w-none print:px-2 print:space-y-4">
          <div data-section="progress" className="print:break-inside-avoid">
            <AgentProgressPanel progress={progress} status={reportStatus ?? "failed"} />
          </div>
          {reportStatus === "partial" && (
            <StatusBanner text="This report is partial. Some agents failed or returned incomplete output, so the final verdict uses only available evidence." />
          )}
          {reportStatus === "failed" && (
            <StatusBanner text={reportError || "The swarm could not complete this analysis."} />
          )}
          <div data-section="truth-score" className="print:break-inside-avoid">
            <TruthScoreCard r={r} progress={progress} />
          </div>
          <div data-section="culture" className="print:break-inside-avoid">
            <ToxicityCard r={r} progress={progress} />
          </div>
          <div data-section="burnout" className="print:break-inside-avoid">
            <BurnoutGhostCard r={r} progress={progress} />
          </div>
          <div data-section="salary" className="print:break-inside-avoid">
            <SalaryCard r={r} progress={progress} />
          </div>
          {r.salary?.equityDetails && (
            <div data-section="equity-simulator" className="print:break-inside-avoid">
              <EquitySimulatorCard r={r} />
            </div>
          )}
          <div data-section="lie-detector" className="print:break-inside-avoid">
            <LieDetectorCard r={r} progress={progress} />
          </div>
          <div data-section="legal-traps" className="print:break-inside-avoid">
            <LegalTrapCard r={r} progress={progress} />
          </div>
          <div data-section="reverse-questions" className="print:break-inside-avoid">
            <ReverseQuestionsCard r={r} progress={progress} />
          </div>
          <div data-section="simulation" className="print:break-inside-avoid">
            <SimulationCard r={r} progress={progress} />
          </div>
          <div data-section="critic" className="print:break-inside-avoid">
            <CriticCard r={r} progress={progress} />
          </div>
          <div data-section="negotiation" className="print:break-inside-avoid">
            <NegotiationCard r={r} progress={progress} />
          </div>
          <div data-section="manager-radar" className="print:break-inside-avoid">
            <ManagerRadarCard r={r} progress={progress} />
          </div>
          <div data-section="power-dynamics" className="print:break-inside-avoid">
            <PowerDynamicsCard r={r} progress={progress} />
          </div>
          <div data-section="team-chemistry" className="print:break-inside-avoid">
            <TeamChemistryCard r={r} progress={progress} />
          </div>
          <div data-section="company-deep-dive" className="print:break-inside-avoid">
            <CompanyDeepDiveCard r={r} progress={progress} />
          </div>
          <div data-section="disclaimer">
            <p className="text-xs text-body/70 text-center pt-6">
              Signals are interpretive, not factual claims. Always do your own research before
              accepting an offer.
            </p>
          </div>
        </div>
      </div>
      {currentData.sourceText && (
        <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-6 print:hidden">
          <details className="rounded-2xl border border-ink/10 bg-white shadow-sm">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-ink">
              Your submission — the exact text this analysis was run on
            </summary>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-ink/10 px-5 py-4 text-xs leading-relaxed text-body font-mono">
              {currentData.sourceText}
            </pre>
          </details>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pb-10 flex flex-wrap items-center justify-center gap-3 print:hidden">
        {downloading ? (
          <button
            onClick={cancelDownload}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors"
            type="button"
          >
            <X size={14} /> Cancel
          </button>
        ) : (
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors disabled:opacity-60"
            type="button"
          >
            <Download size={14} /> Download as PDF
          </button>
        )}
        {!downloading && (
          <button
            onClick={printReport}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-cream transition-colors"
            type="button"
          >
            <Printer size={14} /> Print report
          </button>
        )}
        {!downloading && (
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
          >
            Analyze another job <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </main>
  );
}

function ReportErrorView({ error, reset }: { error: Error; reset: () => void }) {
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

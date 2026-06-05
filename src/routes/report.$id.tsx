import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Quote,
  ArrowRight,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import DashboardSidebar from "@/components/DashboardSidebar";
import { getLocalAnalysis, type LocalAnalysisRecord } from "@/lib/local-analysis";
import { useFirebaseAuth } from "@/lib/firebase-auth";
import { getAbsoluteUrl } from "@/lib/site-url";
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

// jsPDF's bundled Helvetica font only supports WinAnsi (cp1252). Replace common
// Unicode characters with ASCII equivalents so the cover page and page header
// never render as empty boxes / question marks.
function sanitizeForDefaultFont(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // Any non-Latin-1 character (above U+00FF) - replace with "?" since
    // jsPDF's default Helvetica only supports WinAnsi/cp1252.
    .replace(/[^\u0020-\u00FF]/g, "?");
}

// Tailwind v4 emits colors as `oklab(...)` / `oklch(...)`, and html2canvas
// 1.4.1's color parser throws "Attempting to parse an unsupported color
// function" on those. Browsers that can read the value can also resolve it
// via a 2D canvas (the canvas normalises the fillStyle back to rgba/hex),
// so we round-trip every modern CSS color through the canvas before handing
// the cloned document to html2canvas.
const MODERN_COLOR_RE = /(oklab|oklch|color\()\s*\(/i;

function resolveModernColor(value: string): string {
  if (typeof value !== "string" || !MODERN_COLOR_RE.test(value)) return value;
  if (typeof document === "undefined") return value;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    return value;
  }
  if (!ctx) return value;
  try {
    // Reset to a known value first so the canvas isn't holding an old
    // fillStyle that already short-circuited the assignment.
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillStyle = value;
    return ctx.fillStyle as string;
  } catch {
    return value;
  }
}

async function waitForPdfLayout(): Promise<boolean> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      // Some browsers expose `fonts` but reject ready; fall through.
    }
  }
  // Multiple frames lets React effects, image decodes, and reflows settle.
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

  if (typeof document !== "undefined") {
    const images = Array.from(document.images).filter(
      (img) => !img.complete || img.naturalWidth === 0,
    );
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              // Safety timeout: don't block the export forever on a stalled image.
              window.setTimeout(done, 2000);
            }),
        ),
      );
    }
  }
  return true;
}

async function captureSectionCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Pre-flight: bail out before we hand html2canvas a section so tall that
  // the resulting bitmap would exceed the browser's max canvas dimension
  // (Chrome: 16384, Firefox: 32767, Safari: 4096-8192 depending on iOS / macOS).
  const rect = el.getBoundingClientRect();
  const projectedHeightPx = Math.ceil(rect.height * 2);
  const projectedWidthPx = Math.ceil(rect.width * 2);
  const MAX_DIM = 16000;
  if (projectedHeightPx > MAX_DIM || projectedWidthPx > MAX_DIM) {
    throw new Error(
      `Section "${el.dataset.section ?? "(unnamed)"}" is too large to render in one pass ` +
        `(${projectedWidthPx}x${projectedHeightPx}px). Try reducing its size.`,
    );
  }

  const baseOptions = {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    removeContainer: true,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      // Strip fixed/sticky positioning which can throw off html2canvas and
      // tends to render as duplicates of nav bars or sidebars in the PDF.
      // Also normalise every modern CSS color (oklab/oklch/color()) on the
      // element and any stylesheet rule, because html2canvas 1.4.1 throws
      // "Attempting to parse an unsupported color function" on those.
      const COLOR_PROPS: (keyof CSSStyleDeclaration)[] = [
        "color",
        "backgroundColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
        "outlineColor",
        "fill",
        "stroke",
        "textDecorationColor",
        "columnRuleColor",
        "caretColor",
      ];
      clonedEl.querySelectorAll<HTMLElement>("*").forEach((node) => {
        const computed = clonedDoc.defaultView?.getComputedStyle(node);
        if (computed && (computed.position === "fixed" || computed.position === "sticky")) {
          node.style.position = "static";
        }
        if (!computed) return;
        for (const prop of COLOR_PROPS) {
          const value = computed[prop];
          if (typeof value === "string" && MODERN_COLOR_RE.test(value)) {
            const resolved = resolveModernColor(value);
            if (resolved && resolved !== value) {
              (node.style as unknown as Record<string, string>)[prop as string] = resolved;
            }
          }
        }
        // Gradients (backgroundImage, borderImage, maskImage, listStyleImage)
        // can embed oklab() in their color stops. We can't easily resolve
        // those, but we *can* resolve each oklab() inside the string by
        // building an equivalent gradient on a scratch element and asking
        // the browser what the computed color actually is.
        for (const imgProp of ["backgroundImage", "borderImageSource", "maskImage", "listStyleImage"] as const) {
          const value = computed[imgProp];
          if (typeof value === "string" && MODERN_COLOR_RE.test(value)) {
            const resolved = resolveModernColor(value);
            if (resolved && resolved !== value) {
              node.style[imgProp] = resolved;
            }
          }
        }
        // html2canvas 1.4 doesn't paint fully transparent text. Compare the
        // alpha channel numerically rather than the (browser-dependent)
        // string form so Safari/Firefox/Chrome all behave the same.
        const colorMatch = computed.color.match(
          /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
        );
        if (colorMatch && (!colorMatch[4] || parseFloat(colorMatch[4]) === 0)) {
          node.style.color = "#1f2937";
        }
      });

      // Walk the cloned stylesheets and rewrite any rule whose value still
      // contains a modern color function. We can only mutate same-origin
      // sheets; cross-origin ones throw on cssRules access and are skipped.
      for (const sheet of Array.from(clonedDoc.styleSheets)) {
        let rules: CSSRuleList | null = null;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        if (!rules) continue;
        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const style = rule.style;
          for (let i = 0; i < style.length; i++) {
            const prop = style.item(i);
            const value = style.getPropertyValue(prop);
            if (!value || !MODERN_COLOR_RE.test(value)) continue;
            const resolved = resolveModernColor(value);
            if (resolved && resolved !== value) {
              style.setProperty(prop, resolved);
            }
          }
        }
      }
    },
  } as const;

  // First try the standard, taint-free path. Only fall back to
  // foreignObjectRendering if the regular render fails - it serialises the
  // DOM as SVG <foreignObject> which taints the canvas whenever the page has
  // any image without CORS headers, breaking the subsequent toDataURL call.
  try {
    return await html2canvas(el, { ...baseOptions, foreignObjectRendering: false });
  } catch (firstErr) {
    console.warn(
      "html2canvas failed with default options, retrying with foreignObjectRendering",
      firstErr,
    );
    return await html2canvas(el, { ...baseOptions, foreignObjectRendering: true });
  }
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  layout: { contentW: number; contentH: number; marginX: number; marginY: number },
): number {
  const { contentW, contentH, marginX, marginY } = layout;
  const ptPerPx = contentW / canvas.width;
  const totalHeightPt = canvas.height * ptPerPx;

  if (totalHeightPt <= contentH) {
    const imgW = contentW;
    const imgH = canvas.height * ptPerPx;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", marginX, marginY, imgW, imgH);
    return 1;
  }

  // Multi-page section: slice vertically. Use a small overlap so a glyph that
  // straddles a slice boundary appears in full on at least one page instead of
  // being cut at a pixel boundary.
  const overlapPx = 12;
  const baseSlicePx = Math.max(1, Math.floor(contentH / ptPerPx) - overlapPx);
  const numPages = Math.max(1, Math.ceil(canvas.height / baseSlicePx));
  let pagesAdded = 0;

  for (let p = 0; p < numPages; p++) {
    const sy = Math.max(0, p * baseSlicePx - (p > 0 ? overlapPx : 0));
    const sh = Math.min(baseSlicePx + (p > 0 ? overlapPx : 0), canvas.height - sy);
    if (sh <= 0) continue;

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sh;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) {
      console.warn("Could not get 2d context for canvas slice");
      continue;
    }
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);

    let imgData: string;
    try {
      imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    } catch (dataErr) {
      console.warn("toDataURL failed on slice canvas, skipping page", dataErr);
      continue;
    } finally {
      // Free the slice canvas immediately.
      sliceCanvas.width = 0;
      sliceCanvas.height = 0;
    }

    const imgW = contentW;
    const imgH = contentW * sh / canvas.width;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", marginX, marginY, imgW, imgH);
    pagesAdded++;
  }

  return pagesAdded;
}

function addSectionErrorPage(
  pdf: jsPDF,
  sectionName: string,
  err: unknown,
  marginX: number,
  marginY: number,
  contentW: number,
): number {
  const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
  pdf.addPage();
  pdf.setFontSize(12);
  pdf.setTextColor(180, 60, 60);
  pdf.text(`Section "${sanitizeForDefaultFont(sectionName)}" could not be rendered.`, marginX, marginY);
  pdf.setFontSize(10);
  pdf.setTextColor(110, 110, 110);
  const wrapped = pdf.splitTextToSize(sanitizeForDefaultFont(message), contentW);
  pdf.text(wrapped, marginX, marginY + 18);
  return 1;
}

function addHeadersAndFooters(
  pdf: jsPDF,
  layout: {
    headerText: string;
    contentPageCount: number;
    pageW: number;
    pageH: number;
    marginX: number;
  },
) {
  if (layout.contentPageCount <= 0) return;
  for (let i = 2; i <= layout.contentPageCount + 1; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(160, 160, 160);
    pdf.text(layout.headerText, layout.marginX, 22, { align: "left" });
    pdf.text(
      `Page ${i - 1} of ${layout.contentPageCount}`,
      layout.pageW / 2,
      layout.pageH - 16,
      { align: "center" },
    );
  }
}

function handlePdfExportError(err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const errName = err instanceof Error ? err.name : "";
  const isTaintError =
    /taint|cross-origin|securityerror|domexception/i.test(errorMessage) ||
    (errName && /(SecurityError|DOMException)/i.test(errName));

  if (isTaintError) {
    toast.error(
      "PDF export hit a CORS/security issue. Opening your browser's Print dialog instead - save as PDF there.",
    );
  } else if (/timeout|out of memory|maximum canvas/i.test(errorMessage)) {
    toast.error(
      "PDF export failed: the report is too large to render in memory. Use your browser's Print dialog to save as PDF instead.",
    );
  } else {
    toast.error(`PDF export: ${errorMessage}. Opening Print dialog as fallback.`);
  }

  try {
    window.print();
  } catch (printErr) {
    console.error("Print fallback failed:", printErr);
  }
}

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
    if (!reportRef.current) return;
    // Bump the generation token so any earlier in-flight export stops touching
    // state. We re-read this on every await below.
    const myGeneration = ++generationRef.current;
    const isCurrent = () => generationRef.current === myGeneration;

    setDownloading(true);
    try {
      const container = reportRef.current;

      if (!(await waitForPdfLayout()) || !isCurrent()) return;

      const sectionEls = Array.from(
        container.querySelectorAll<HTMLElement>("[data-section]"),
      );
      if (sectionEls.length === 0) {
        throw new Error("No report sections found - cannot generate PDF.");
      }

      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 40;
      const marginY = 50;
      const contentW = pageW - marginX * 2;
      const contentH = pageH - marginY * 2;

      const headerParts = [r.roleTitle, r.company].filter(Boolean) as string[];
      const rawHeaderText = headerParts.length
        ? headerParts.join(" · ")
        : "Analysis Report";
      const headerText = sanitizeForDefaultFont(rawHeaderText);
      const safeCompany = (
        (r.company || "report")
          .replace(/[^a-z0-9-]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase()
          .slice(0, 40) || "report"
      );
      const reportDate = sanitizeForDefaultFont(
        new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );

      // Cover page
      pdf.setFontSize(26);
      pdf.setTextColor(30, 30, 30);
      pdf.text(headerText, pageW / 2, pageH / 2 - 70, { align: "center" });

      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Reverse Interview AI", pageW / 2, pageH / 2 - 30, { align: "center" });
      pdf.text("Analysis Report", pageW / 2, pageH / 2 - 12, { align: "center" });

      pdf.setFontSize(10);
      pdf.setTextColor(140, 140, 140);
      pdf.text(reportDate, pageW / 2, pageH / 2 + 12, { align: "center" });

      if (r.orchestrator) {
        const recBadge =
          r.orchestrator.recommendation === "proceed"
            ? "Proceed"
            : r.orchestrator.recommendation === "caution"
              ? "Proceed with caution"
              : "Avoid";
        pdf.setFontSize(11);
        pdf.setTextColor(60, 60, 60);
        pdf.text(`Verdict: ${recBadge}`, pageW / 2, pageH / 2 + 40, {
          align: "center",
        });
      }

      let pageCount = 1;
      let hadSectionError = false;

      for (let i = 0; i < sectionEls.length; i++) {
        if (!isCurrent()) return;
        const el = sectionEls[i];
        const sectionName = el.dataset.section || `Section ${i + 1}`;

        try {
          const canvas = await captureSectionCanvas(el);
          if (!isCurrent()) return;

          if (canvas.width === 0 || canvas.height === 0) {
            console.warn(`Section "${sectionName}" rendered empty canvas, skipping`);
            continue;
          }

          pageCount += addCanvasToPdf(pdf, canvas, {
            contentW,
            contentH,
            marginX,
            marginY,
          });
        } catch (sectionErr) {
          hadSectionError = true;
          console.error(`Section "${sectionName}" failed to capture:`, sectionErr);
          pageCount += addSectionErrorPage(
            pdf,
            sectionName,
            sectionErr,
            marginX,
            marginY,
            contentW,
          );
        }
      }

      if (!isCurrent()) return;

      addHeadersAndFooters(pdf, {
        headerText,
        contentPageCount: pageCount - 1,
        pageW,
        pageH,
        marginX,
      });

      pdf.save(`reverse-interview-${safeCompany}.pdf`);

      if (hadSectionError) {
        toast.warning(
          "PDF generated, but one or more sections could not be captured. Check the file for placeholder pages.",
        );
      }
    } catch (err) {
      if (!isCurrent()) return;
      console.error("PDF export error:", err);
      handlePdfExportError(err);
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

  return (
    <main className="min-h-screen bg-paper lg:pl-72 print:bg-white print:pl-0 print:text-black">
      <div className="print:hidden">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
      </div>
      <div ref={reportRef} className="print:max-w-none">
        <div data-section="verdict" className="print:break-inside-avoid">
          <VerdictHero r={r} status={reportStatus ?? "failed"} error={reportError} />
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
          <div data-section="culture-burnout" className="grid gap-6 lg:grid-cols-2 print:break-inside-avoid">
            <ToxicityCard r={r} progress={progress} />
            <BurnoutGhostCard r={r} progress={progress} />
          </div>
          <div data-section="salary" className="print:break-inside-avoid">
            <SalaryCard r={r} progress={progress} />
          </div>
          <div data-section="lie-detector" className="print:break-inside-avoid">
            <LieDetectorCard r={r} progress={progress} />
          </div>
          <div data-section="reverse-questions" className="print:break-inside-avoid">
            <ReverseQuestionsCard r={r} progress={progress} />
          </div>
          <div data-section="simulation" className="print:break-inside-avoid">
            <SimulationCard r={r} progress={progress} />
          </div>
          <div data-section="negotiation" className="print:break-inside-avoid">
            <NegotiationCard r={r} progress={progress} />
          </div>
          <div data-section="disclaimer">
            <p className="text-xs text-body/70 text-center pt-6">
              Signals are interpretive, not factual claims. Always do your own research before
              accepting an offer.
            </p>
          </div>
        </div>
      </div>
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

function TruthScoreCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
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

function ToxicityCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
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

function SalaryCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
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
        <span className="font-medium">Estimated market range:</span> {r.salary.marketRangeEstimate}
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

function SimulationCard({ r, progress }: { r: PartialAnalysisResult; progress: AnalysisProgress }) {
  if (!r.simulation) {
    return <SectionFallback title="If you join - a simulation" progress={progress.simulation} />;
  }
  return (
    <Card
      title="If you join — a simulation"
      subtitle={`Promotion likelihood: ${Math.round(
        r.simulation.promotionProbability,
      )}% · Retention: ${Math.round(r.simulation.retentionProbability)}%`}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {r.simulation.phases.map((p) => (
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

function MiniStatus({ label, progress }: { label: string; progress?: AnalysisProgress[AgentId] }) {
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

function Gauge({ label, v }: { label: string; v: number }) {
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

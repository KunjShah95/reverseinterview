import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Building2,
  Type,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Flame,
  DollarSign,
  Search,
  Handshake,
  MessageSquare,
  Scan,
  Clock,
  Brain,
  Gavel,
  UserSearch,
  Siren,
  Users,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { getSessionId } from "@/lib/session";
import type { OcrSummary } from "@/lib/ocr-types";
import {
  getPdfInfo,
  extractPdfPages,
  extractFromImage,
  lookupCompany,
  type DocTypeResult,
} from "@/lib/extract.functions";
import { createLocalAnalysis, saveLocalAnalysis } from "@/lib/local-analysis";
import { startAnalysis, pollAnalysis } from "@/lib/run-analysis";
import type { RunProgress } from "@/lib/run-analysis";
import type { AnalysisProgress, PreliminaryResponse } from "@/lib/analysis-types";
import { firebaseAuth } from "@/lib/firebase-auth";

const AGENT_STEPS: { id: keyof RunProgress; label: string; icon: typeof Sparkles }[] = [
  { id: "culture", label: "Culture & toxicity scan", icon: ShieldAlert },
  { id: "burnout", label: "Burnout risk assessment", icon: Flame },
  { id: "salary", label: "Salary fairness analysis", icon: DollarSign },
  { id: "ghost", label: "Ghost-hiring detection", icon: Search },
  { id: "negotiation", label: "Negotiation strategy", icon: Handshake },
  { id: "reverse", label: "Reverse interview questions", icon: MessageSquare },
  { id: "lie", label: "HR claim verification", icon: Scan },
  { id: "simulation", label: "Career simulation", icon: Clock },
  { id: "legal", label: "Legal scan", icon: Gavel },
  { id: "managerRadar", label: "Manager radar", icon: UserSearch },
  { id: "powerDynamics", label: "Power dynamics", icon: Siren },
  { id: "teamChemistry", label: "Team chemistry", icon: Users },
  { id: "critic", label: "Peer review", icon: Brain },
  { id: "orchestrator", label: "Final verdict", icon: Gavel },
];

const DEMO_JD = `Senior Full-Stack Engineer — URGENT HIRE

We're a fast-paced, family-style startup looking for a true rockstar who can wear many hats and thrive under pressure. You'll own the entire product end-to-end, work directly with the founders, and ship at lightning speed.

Responsibilities:
- Build features across frontend, backend, mobile, and infrastructure
- Handle on-call rotations (we move fast and break things, then fix them at 2am)
- Be a self-starter — we don't micromanage
- Wear multiple hats: design, engineering, customer support
- 5+ years experience required, but we move like a 1-year-old startup
- Salary: $85,000 - $110,000 (very competitive!)
- "Unlimited" PTO — most people take ~10 days
- Equity: TBD after 6-month review
- Location: Remote, but you must overlap 6+ hours with PST

We value work-life balance and a flat hierarchy. Apply ASAP — we're filling this immediately!`;

type Mode = "text" | "pdf" | "image" | "company";

export const Route = createFileRoute("/analyze")({
  validateSearch: z.object({ demo: z.number().optional() }),
  head: () => ({
    meta: [
      { title: "Analyze a job — Reverse Interview AI" },
      {
        name: "description",
        content:
          "Paste a job description, upload a PDF offer letter, drop a screenshot, or just type a company name. Eight AI agents tell you what working there actually looks like.",
      },
      { property: "og:title", content: "Analyze a job — Reverse Interview AI" },
      {
        property: "og:description",
        content:
          "Eight specialist AI agents read the offer in parallel and tell you what working there will actually feel like.",
      },
    ],
  }),
  component: AnalyzePage,
});

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const PDF_CHUNK = 3;

const DOC_LABELS: Record<DocTypeResult["docType"], string> = {
  job_description: "Job description",
  offer_letter: "Offer letter",
  recruiter_chat: "Recruiter chat",
  company_brief: "Company brief",
  unknown: "Document",
};

function AnalyzePage() {
  const { demo } = Route.useSearch();
  const navigate = useNavigate();
  const pdfInfo = useServerFn(getPdfInfo);
  const pdfPages = useServerFn(extractPdfPages);
  const extractImg = useServerFn(extractFromImage);
  const lookup = useServerFn(lookupCompany);

  const [mode, setMode] = useState<Mode | "timeline">("text");
  const [text, setText] = useState(demo ? DEMO_JD : "");
  const [jdText, setJdText] = useState("");
  const [chatText, setChatText] = useState("");
  const [offerText, setOfferText] = useState("");
  const [activeUploadStage, setActiveUploadStage] = useState<"jd" | "chat" | "offer" | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [imgName, setImgName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [ocrMeta, setOcrMeta] = useState<OcrSummary | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const [docType, setDocType] = useState<DocTypeResult | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [company, setCompany] = useState(demo ? "Sample Startup Inc." : "");
  const [roleTitle, setRoleTitle] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [location, setLocation] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [email, setEmail] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);
  const [preliminary, setPreliminary] = useState<PreliminaryResponse | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAnalysisFn = useServerFn(startAnalysis);
  const pollAnalysisFn = useServerFn(pollAnalysis);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  function resetDocType() {
    setDocType(null);
  }

  async function handlePdf(file: File, stageOverride?: "jd" | "chat" | "offer") {
    if (file.size > 18 * 1024 * 1024) {
      toast.error("PDF is too large (max 18MB).");
      return;
    }
    setExtracting(true);
    setPdfName(file.name);
    setPdfProgress(null);
    resetDocType();
    setOcrMeta(null);
    try {
      const base64 = await fileToBase64(file);

      let info: { numPages: number; hasText: boolean; warning: string | null };
      try {
        info = await pdfInfo({ data: { base64 } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to open PDF.";
        toast.error(msg);
        return;
      }

      if (info.warning) {
        toast.warning(info.warning);
      }
      if (info.numPages === 0) {
        toast.error("This PDF reports 0 pages — it may be corrupted.");
        return;
      }

      setPdfProgress({ current: 0, total: info.numPages });
      const chunks: string[] = [];
      let extractedSoFar = 0;
      const confidences: number[] = [];
      const warnings = new Set<string>();
      let extractionMethod: OcrSummary["method"] = "text-extract";
      for (let from = 1; from <= info.numPages; from += PDF_CHUNK) {
        const to = Math.min(from + PDF_CHUNK - 1, info.numPages);
        try {
          const {
            text: t,
            pagesExtracted,
            method,
            confidence,
            warnings: pageWarnings,
          } = await pdfPages({ data: { base64, fromPage: from, toPage: to } });
          if (t) chunks.push(t);
          extractedSoFar += pagesExtracted;
          confidences.push(confidence ?? 0);
          if (method !== "text-extract") {
            warnings.add("Scanned PDF OCR was used for at least one page.");
            extractionMethod = "tesseract";
          }
          for (const warning of pageWarnings ?? []) warnings.add(warning);
          setPdfProgress({ current: to, total: info.numPages });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "page extraction failed";
          toast.error(`Failed on pages ${from}–${to}: ${msg}`);
          break;
        }
      }

      const merged = chunks.join("\n\n").slice(0, 80_000);
      if (merged.trim().length < 40) {
        toast.error(
          "Pulled the PDF apart but found almost no text. It's likely scanned — try the Screenshot tab instead.",
        );
      } else {
        const targetStage = stageOverride || activeUploadStage;
        if (targetStage === "jd") {
          setJdText(merged);
        } else if (targetStage === "chat") {
          setChatText(merged);
        } else if (targetStage === "offer") {
          setOfferText(merged);
        } else {
          setText(merged);
        }
        const averageConfidence = confidences.length
          ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
          : 0;
        setOcrMeta({
          method: extractionMethod,
          confidence: averageConfidence,
          warnings: [...warnings],
          pagesProcessed: extractedSoFar,
        });
        toast.success(
          `Extracted ${extractedSoFar} page${extractedSoFar === 1 ? "" : "s"} (${merged.length.toLocaleString()} chars) from ${file.name}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF parse failed.";
      toast.error(msg);
    } finally {
      setExtracting(false);
      setPdfProgress(null);
      setActiveUploadStage(null);
    }
  }

  async function handleImage(file: File, stageOverride?: "jd" | "chat" | "offer") {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image is too large (max 12MB).");
      return;
    }
    setExtracting(true);
    setImgName(file.name);
    resetDocType();
    setOcrMeta(null);
    try {
      const base64 = await fileToBase64(file);
      const {
        text: extracted,
        confidence,
        method,
        warnings,
        averageWordCount,
      } = await extractImg({
        data: { base64, mimeType: file.type || "image/png" },
      });
      if (extracted.trim().length < 20) {
        toast.error("No readable text found in the image.");
      } else {
        const targetStage = stageOverride || activeUploadStage;
        if (targetStage === "jd") {
          setJdText(extracted);
        } else if (targetStage === "chat") {
          setChatText(extracted);
        } else if (targetStage === "offer") {
          setOfferText(extracted);
        } else {
          setText(extracted);
        }
        setOcrMeta({
          method,
          confidence,
          warnings: warnings ?? [],
          averageWordCount,
        });
        toast.success("Transcribed screenshot — review below, then run analysis.");
      }
    } catch (err) {
      toast.error("Image OCR failed.");
    } finally {
      setExtracting(false);
      setActiveUploadStage(null);
    }
  }

  async function handleLookup() {
    if (companyQuery.trim().length < 2) {
      toast.error("Enter a company name or URL.");
      return;
    }
    setExtracting(true);
    resetDocType();
    try {
      const { text: extracted, brief } = await lookup({
        data: { query: companyQuery },
      });
      setText(extracted);
      setOcrMeta(null);
      if (!company && brief?.companyName) setCompany(brief.companyName);
      toast.success(
        brief?.sourcesUsed?.length
          ? `Pulled ${brief.sourcesUsed.length} page(s) — review below, then run analysis.`
          : "Loaded company brief — review below, then run analysis.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lookup failed.";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let sourceTextVal = text;
    if (mode === "timeline") {
      const parts = [
        jdText && `=== STAGE 1: JOB DESCRIPTION ===\n${jdText}`,
        chatText && `=== STAGE 2: RECRUITER CHAT ===\n${chatText}`,
        offerText && `=== STAGE 3: OFFER LETTER / CONTRACT ===\n${offerText}`,
      ].filter(Boolean);
      sourceTextVal = parts.join("\n\n");
    }

    if (sourceTextVal.trim().length < 40) {
      toast.error("Need at least a few sentences before we can analyze.");
      return;
    }
    setSubmitting(true);
    setRunProgress({
      culture: "running",
      burnout: "running",
      salary: "running",
      ghost: "running",
      negotiation: "running",
      reverse: "running",
      lie: "running",
      simulation: "running",
      legal: "running",
      managerRadar: "running",
      powerDynamics: "running",
      teamChemistry: "running",
      companyDeepDive: "pending",
      critic: "pending",
      orchestrator: "pending",
    });

    try {
      const { analysisId } = await startAnalysisFn({
        data: {
          sourceText: sourceTextVal,
          company: company || undefined,
          roleTitle: roleTitle || undefined,
          offeredSalary: offeredSalary || undefined,
          location: location || undefined,
          yearsExperience: yearsExperience || undefined,
          jobDescriptionText: mode === "timeline" ? jdText || undefined : undefined,
          recruiterChatText: mode === "timeline" ? chatText || undefined : undefined,
          offerLetterText: mode === "timeline" ? offerText || undefined : undefined,
          email: email || undefined,
          emailConsent: emailConsent || undefined,
        },
      });

      // Reuse the server-issued analysisId as the local record id so a heuristic
      // fallback and the real AI record can never coexist as duplicate cards.
      const goToFallback = () => {
        const fallback = createLocalAnalysis({
          sourceText: sourceTextVal,
          company: company || undefined,
          roleTitle: roleTitle || undefined,
          offeredSalary: offeredSalary || undefined,
          location: location || undefined,
          yearsExperience: yearsExperience || undefined,
          jobDescriptionText: mode === "timeline" ? jdText || undefined : undefined,
          recruiterChatText: mode === "timeline" ? chatText || undefined : undefined,
          offerLetterText: mode === "timeline" ? offerText || undefined : undefined,
          sessionId: getSessionId(),
        });
        const record = { ...fallback, id: analysisId };
        const uid = firebaseAuth?.currentUser?.uid ?? undefined;
        saveLocalAnalysis(record, uid);
        toast.info("Created a report with initial analysis while deeper AI analysis continues.");
        setSubmitting(false);
        setRunProgress(null);
        navigate({ to: "/report/$id", params: { id: analysisId } });
      };

      // Tolerate a few transient poll misses (cold start / cross-instance) before
      // giving up — the durable job store usually recovers within a tick or two.
      let missStreak = 0;
      const MAX_MISSES = 4;

      pollingRef.current = setInterval(async () => {
        try {
          const result = await pollAnalysisFn({ data: { analysisId } });

          if (result.status === "expired") {
            missStreak += 1;
            if (missStreak >= MAX_MISSES) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              goToFallback();
            }
            return;
          }
          missStreak = 0;

          if (result.progress) setRunProgress(result.progress);
          if (result.preliminary && !preliminary) {
            setPreliminary(result.preliminary);
          }
          if ((result.status === "complete" || result.status === "partial") && result.result) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;

            const now = new Date().toISOString();
            const finalProgress = {} as AnalysisProgress;
            for (const key of Object.keys(result.progress) as (keyof RunProgress)[]) {
              finalProgress[key] = {
                status: result.progress[key],
                startedAt: now,
                completedAt: now,
              };
            }
            const record = {
              id: analysisId,
              sessionId: getSessionId(),
              company: result.result.company || null,
              createdAt: now,
              startedAt: now,
              completedAt: now,
              status: result.status,
              error: result.error || null,
              progress: finalProgress,
              result: result.result,
              sourceText: sourceTextVal,
            };
            const uid = firebaseAuth?.currentUser?.uid ?? undefined;
            saveLocalAnalysis(record, uid);
            setSubmitting(false);
            setRunProgress(null);
            navigate({ to: "/report/$id", params: { id: analysisId } });
          }
          if (result.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            goToFallback();
          }
        } catch (pollErr) {
          // Network error on a single tick — tolerate transient failures, only
          // fall back after the miss streak is exhausted.
          missStreak += 1;
          if (missStreak >= MAX_MISSES) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            goToFallback();
          }
        }
      }, 1500);
    } catch (err) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      const fallback = createLocalAnalysis({
        sourceText: sourceTextVal,
        company: company || undefined,
        roleTitle: roleTitle || undefined,
        offeredSalary: offeredSalary || undefined,
        location: location || undefined,
        yearsExperience: yearsExperience || undefined,
        jobDescriptionText: mode === "timeline" ? jdText || undefined : undefined,
        recruiterChatText: mode === "timeline" ? chatText || undefined : undefined,
        offerLetterText: mode === "timeline" ? offerText || undefined : undefined,
        sessionId: getSessionId(),
      });
      const uid = firebaseAuth?.currentUser?.uid ?? undefined;
      saveLocalAnalysis(fallback, uid);
      toast.info("Created a report with initial analysis while deeper AI analysis continues.");
      setSubmitting(false);
      setRunProgress(null);
      navigate({ to: "/report/$id", params: { id: fallback.id } });
    }
  }

  const modeTabs: { id: Mode | "timeline"; label: string; icon: typeof Type }[] = [
    { id: "text", label: "Paste text", icon: Type },
    { id: "pdf", label: "Upload PDF", icon: FileText },
    { id: "image", label: "Screenshot", icon: ImageIcon },
    { id: "company", label: "Company URL", icon: Building2 },
    { id: "timeline", label: "Audit timeline", icon: Clock },
  ];

  const pct = pdfProgress
    ? Math.round((pdfProgress.current / Math.max(pdfProgress.total, 1)) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20">
        <header className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink">
            <Sparkles size={12} /> Multi-agent analysis
          </span>
          <h1
            className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl text-ink mx-auto"
            style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
          >
            Paste, drop, or look up. We&apos;ll read between the{" "}
            <span className="italic" style={{ color: "var(--heading-accent)" }}>
              lines.
            </span>
          </h1>
          <p className="mt-4 text-body max-w-2xl mx-auto">
            Bring the job description, offer letter, recruiter screenshot, or just a company URL.
            Eight specialist agents analyze toxicity, burnout, salary fairness, ghost-hiring
            signals, and write the questions you should ask back.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8 shadow-sm"
        >
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 rounded-xl bg-cream/60 border border-ink/10">
            {modeTabs.map((t) => {
              const Icon = t.icon;
              const active = mode === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setMode(t.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-ink shadow-sm border border-ink/10"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {mode === "pdf" && (
            <>
              <FileDrop
                accept="application/pdf"
                label={pdfName ?? "Drop a PDF offer letter or JD"}
                hint="Up to 18MB. Extracted page-by-page on the server — file is not stored."
                busy={extracting}
                onFile={handlePdf}
              />
              {pdfProgress && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-body mb-1">
                    <span>
                      Extracting page {pdfProgress.current} of {pdfProgress.total}…
                    </span>
                    <span className="font-medium text-ink">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: "var(--heading-accent)",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
          {mode === "image" && (
            <FileDrop
              accept="image/png,image/jpeg,image/webp"
              label={imgName ?? "Drop a screenshot (PNG / JPG / WEBP)"}
              hint="Open-source OCR (tesseract/pdf) extracts text — review the result before analysis."
              busy={extracting}
              onFile={handleImage}
            />
          )}
          {mode === "company" && (
            <div className="rounded-xl border border-ink/15 bg-cream/40 p-4">
              <label className="block text-sm font-medium text-ink mb-2">Company URL or name</label>
              <div className="flex gap-2">
                <input
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="example.com  or  Company Name"
                  className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-heading/40"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={extracting}
                  className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink-hover disabled:opacity-60"
                >
                  {extracting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Fetch
                </button>
              </div>
              <p className="mt-2 text-xs text-body/80">
                URLs are fetched, then About / Values / Benefits / Careers pages are pulled and
                summarized. Plain names fall back to a public-knowledge brief.
              </p>
            </div>
          )}

          {mode === "timeline" ? (
            <div className="mt-6 space-y-6">
              {[
                { key: "jd" as const, label: "Stage 1: Job Description", value: jdText, setValue: setJdText, placeholder: "Paste the initial job description here..." },
                { key: "chat" as const, label: "Stage 2: Recruiter Emails / Chats", value: chatText, setValue: setChatText, placeholder: "Paste recruiter emails, LinkedIn chats, or call notes here..." },
                { key: "offer" as const, label: "Stage 3: Offer Letter / Contract", value: offerText, setValue: setOfferText, placeholder: "Paste the text of the formal offer letter or employment contract here..." },
              ].map((stage) => (
                <div key={stage.key} className="rounded-xl border border-ink/10 bg-cream/20 p-4 relative group">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-ink">{stage.label}</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        id={`timeline-file-${stage.key}`}
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setActiveUploadStage(stage.key);
                            if (f.type === "application/pdf") {
                              handlePdf(f, stage.key);
                            } else {
                              handleImage(f, stage.key);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(`timeline-file-${stage.key}`);
                          el?.click();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-ink/80 hover:text-ink hover:bg-cream/40 transition-colors shadow-sm"
                      >
                        <Upload size={12} />
                        Upload file/img
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={stage.value}
                    onChange={(e) => stage.setValue(e.target.value)}
                    placeholder={stage.placeholder}
                    className="w-full min-h-[140px] rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-heading/40 focus:border-heading/40"
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              <label className="mt-6 block text-sm font-medium text-ink mb-2">
                {mode === "text"
                  ? "Job description / offer letter / HR chat"
                  : "Extracted text (edit if needed)"}
              </label>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  resetDocType();
                }}
                placeholder={
                  mode === "text"
                    ? "Paste the full job posting here..."
                    : "Extracted text will appear here..."
                }
                className="w-full min-h-[260px] rounded-xl border border-ink/15 bg-cream/40 px-4 py-3 text-sm text-ink font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-heading/40 focus:border-heading/40"
                required
              />
            </>
          )}

          {ocrMeta && (
            <div className="mt-3 rounded-xl border border-ink/10 bg-cream/40 px-4 py-3 text-sm text-ink">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">OCR review</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs text-body border border-ink/10">
                  {ocrMeta.method}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs text-body border border-ink/10">
                  confidence {ocrMeta.confidence}%
                </span>
                {typeof ocrMeta.averageWordCount === "number" && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-body border border-ink/10">
                    {ocrMeta.averageWordCount} words
                  </span>
                )}
              </div>
              {ocrMeta.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-body/90 space-y-1">
                  {ocrMeta.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-body/80">
                Please skim the extracted text for headers, bullets, dates, and salary numbers
                before running analysis.
              </p>
            </div>
          )}

          {docType && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream/40 px-3 py-1.5 text-xs text-ink">
              {docType.docType === "unknown" ? (
                <AlertTriangle size={12} className="text-body" />
              ) : (
                <CheckCircle2 size={12} style={{ color: "var(--heading-accent)" }} />
              )}
              <span className="font-medium">{DOC_LABELS[docType.docType]}</span>
              <span className="text-body/80">· {docType.confidence} confidence</span>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Company (optional)"
              value={company}
              onChange={setCompany}
              placeholder="Acme Corp"
            />
            <Field
              label="Role title (optional)"
              value={roleTitle}
              onChange={setRoleTitle}
              placeholder="Senior Engineer"
            />
            <Field
              label="Offered salary (optional)"
              value={offeredSalary}
              onChange={setOfferedSalary}
              placeholder="$120k base + equity"
            />
            <Field
              label="Location (optional)"
              value={location}
              onChange={setLocation}
              placeholder="Remote, US"
            />
            <Field
              label="Your years of experience (optional)"
              value={yearsExperience}
              onChange={setYearsExperience}
              placeholder="5"
            />
          </div>

          <div className="mt-6 border-t border-ink/10 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 rounded-lg border border-ink/15 bg-cream/40 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-heading/40"
              />
              <label className="inline-flex items-center gap-2 text-sm text-ink/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConsent}
                  onChange={(e) => setEmailConsent(e.target.checked)}
                  className="rounded border-ink/30"
                />
                Email me the full report + deep dive
              </label>
            </div>
            <p className="mt-1.5 text-xs text-body/60">
              We'll send a rich HTML report with PDF attachment when analysis completes.
              No spam, no storage of your email.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || extracting}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream transition-colors hover:bg-ink-hover disabled:opacity-60"
            >
              {submitting && !runProgress ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Starting AI agents...
                </>
              ) : submitting && runProgress ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analysis in progress...
                </>
              ) : (
                <>Run analysis →</>
              )}
            </button>
            {mode === "text" && !demo && (
              <button
                type="button"
                onClick={() => {
                  setText(DEMO_JD);
                  setCompany("Sample Startup Inc.");
                  resetDocType();
                  toast("Loaded a sample toxic JD — submit to see the magic.");
                }}
                className="text-sm text-ink/70 hover:text-ink underline-offset-4 hover:underline"
              >
                Or load a sample
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-body/80">
            10 AI agents analyze your text in parallel — culture, burnout, salary, ghost-hiring, and
            more. Results appear as each agent completes. We never share what you paste.
          </p>
        </form>

        {preliminary && (
          <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-heading" />
              <span className="text-sm font-semibold text-ink">Quick read</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-ink/70">Vibe:</span>
              <div className="flex-1 h-2 rounded-full bg-ink/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${preliminary.vibeScore}%`,
                    backgroundColor: preliminary.vibeScore >= 60 ? "var(--safe)" : preliminary.vibeScore >= 35 ? "var(--caution)" : "var(--danger)",
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-ink w-10 text-right">{preliminary.vibeScore}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                {preliminary.topRedFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-700 mb-1">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
              <div>
                {preliminary.topGreenFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-green-700 mb-1">
                    <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-body/60">Full deep-dive analysis still running in background...</p>
          </div>
        )}

        {runProgress && (
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
        )}
      </div>
    </main>
  );
}

function FileDrop({
  accept,
  label,
  hint,
  busy,
  onFile,
}: {
  accept: string;
  label: string;
  hint: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center text-center cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
        dragging ? "border-heading bg-heading/5" : "border-ink/20 bg-cream/40 hover:bg-cream/60"
      }`}
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {busy ? (
        <Loader2 size={28} className="animate-spin text-ink/60" />
      ) : (
        <Upload size={28} className="text-ink/60" />
      )}
      <span className="mt-3 text-sm font-medium text-ink">{label}</span>
      <span className="mt-1 text-xs text-body/80">{hint}</span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ink/15 bg-cream/40 px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-heading/40 focus:border-heading/40"
      />
    </label>
  );
}

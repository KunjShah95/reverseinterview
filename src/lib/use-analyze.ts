import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSessionId } from "./session";
import type { OcrSummary } from "./ocr-types";
import {
  getPdfInfo,
  extractPdfPages,
  extractFromImage,
  lookupCompany,
  type DocTypeResult,
} from "./extract.functions";
import { createLocalAnalysis, saveLocalAnalysis } from "./local-analysis";
import { startAnalysis, pollAnalysis } from "./run-analysis";
import type { RunProgress } from "./run-analysis";
import type { AnalysisProgress, PreliminaryResponse } from "./analysis-types";
import { firebaseAuth } from "./firebase-auth";
import {
  CLOUD_SYNC_BLOCKED_EVENT,
  maybeWarnCloudSyncBlocked,
} from "./cloud-sync-notice";
import { DEMO_JD, PDF_CHUNK, fileToBase64, type Mode } from "./analyze-constants";

/**
 * Owns all Analyze-page state, extraction handlers, and the submit/poll loop.
 * Kept out of the route component so the page file is JSX-only.
 */
export function useAnalyze(demo: number | undefined) {
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
    const onCloudBlocked = () => maybeWarnCloudSyncBlocked();
    window.addEventListener(CLOUD_SYNC_BLOCKED_EVENT, onCloudBlocked);
    return () => {
      window.removeEventListener(CLOUD_SYNC_BLOCKED_EVENT, onCloudBlocked);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // If cloud sync was already marked blocked (login-time sync usually trips the
  // detector before the user submits), warn immediately — the event would have
  // fired on an earlier page, not here. Idempotent via the module-level flag.
  function warnIfCloudBlocked(uid?: string) {
    if (!uid) return;
    import("./firestore")
      .then(({ isFirestoreBlocked }) => {
        if (isFirestoreBlocked()) maybeWarnCloudSyncBlocked();
      })
      .catch(() => {});
  }

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
      const startResult = await startAnalysisFn({
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

      // Relevance gate rejected the input — no analysis ran, no tokens spent.
      if ("rejected" in startResult && startResult.rejected) {
        toast.error(startResult.reason);
        setSubmitting(false);
        setRunProgress(null);
        return;
      }

      const { analysisId } = startResult;

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
        warnIfCloudBlocked(uid);
        toast.info("Created a report with initial analysis while deeper AI analysis continues.");
        setSubmitting(false);
        setRunProgress(null);
        navigate({ to: "/report/$id", params: { id: analysisId } });
      };

      // Tolerate a few transient poll misses (cold start / cross-instance) before
      // giving up — the durable job store usually recovers within a tick or two.
      let missStreak = 0;
      const MAX_MISSES = 8;

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
            warnIfCloudBlocked(uid);
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
      warnIfCloudBlocked(uid);
      toast.info("Created a report with initial analysis while deeper AI analysis continues.");
      setSubmitting(false);
      setRunProgress(null);
      navigate({ to: "/report/$id", params: { id: fallback.id } });
    }
  }

  const pct = pdfProgress
    ? Math.round((pdfProgress.current / Math.max(pdfProgress.total, 1)) * 100)
    : 0;

  return {
    // mode + text sources
    mode,
    setMode,
    text,
    setText,
    jdText,
    setJdText,
    chatText,
    setChatText,
    offerText,
    setOfferText,
    activeUploadStage,
    setActiveUploadStage,
    companyQuery,
    setCompanyQuery,
    // extraction state
    pdfName,
    imgName,
    extracting,
    ocrMeta,
    pdfProgress,
    pct,
    docType,
    detecting,
    setDetecting,
    // metadata fields
    company,
    setCompany,
    roleTitle,
    setRoleTitle,
    offeredSalary,
    setOfferedSalary,
    location,
    setLocation,
    yearsExperience,
    setYearsExperience,
    email,
    setEmail,
    emailConsent,
    setEmailConsent,
    // run state
    submitting,
    runProgress,
    preliminary,
    // handlers
    resetDocType,
    handlePdf,
    handleImage,
    handleLookup,
    onSubmit,
  };
}

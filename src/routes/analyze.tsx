import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  Loader2,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { DEMO_JD, DOC_LABELS, MODE_TABS } from "@/lib/analyze-constants";
import { useAnalyze } from "@/lib/use-analyze";
import { FileDrop, Field } from "@/components/analyze/form-controls";
import { AnalysisProgress } from "@/components/analyze/AnalysisProgress";
import { PreliminaryCard } from "@/components/analyze/PreliminaryCard";

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
      { property: "og:image", content: "/og.svg" },
    ],
    links: [{ rel: "canonical", href: "https://reverseinterview.vercel.app/analyze" }],
  }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const { demo } = Route.useSearch();
  const {
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
    setActiveUploadStage,
    companyQuery,
    setCompanyQuery,
    pdfName,
    imgName,
    extracting,
    ocrMeta,
    pdfProgress,
    pct,
    docType,
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
    submitting,
    runProgress,
    preliminary,
    resetDocType,
    handlePdf,
    handleImage,
    handleLookup,
    onSubmit,
  } = useAnalyze(demo);

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
            {MODE_TABS.map((t) => {
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

        {preliminary && <PreliminaryCard preliminary={preliminary} />}

        {runProgress && <AnalysisProgress runProgress={runProgress} />}
      </div>
    </main>
  );
}

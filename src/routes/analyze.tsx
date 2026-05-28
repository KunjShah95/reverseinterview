import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, FileText, Image as ImageIcon, Building2, Type, Upload } from "lucide-react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import { runAnalysis } from "@/lib/analysis.functions";
import {
  extractFromPdf,
  extractFromImage,
  lookupCompany,
} from "@/lib/extract.functions";
import { getSessionId } from "@/lib/session";

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

function AnalyzePage() {
  const { demo } = Route.useSearch();
  const navigate = useNavigate();
  const run = useServerFn(runAnalysis);
  const extractPdf = useServerFn(extractFromPdf);
  const extractImg = useServerFn(extractFromImage);
  const lookup = useServerFn(lookupCompany);

  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState(demo ? DEMO_JD : "");
  const [companyQuery, setCompanyQuery] = useState("");
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [imgName, setImgName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [company, setCompany] = useState(demo ? "Sample Startup Inc." : "");
  const [roleTitle, setRoleTitle] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [location, setLocation] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handlePdf(file: File) {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("PDF is too large (max 12MB).");
      return;
    }
    setExtracting(true);
    setPdfName(file.name);
    try {
      const base64 = await fileToBase64(file);
      const { text: extracted } = await extractPdf({
        data: { base64, filename: file.name },
      });
      if (extracted.trim().length < 40) {
        toast.error("Couldn't read text from that PDF. Try a screenshot instead.");
      } else {
        setText(extracted);
        toast.success(`Pulled ${extracted.length.toLocaleString()} chars from ${file.name}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("PDF parse failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleImage(file: File) {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Image is too large (max 12MB).");
      return;
    }
    setExtracting(true);
    setImgName(file.name);
    try {
      const base64 = await fileToBase64(file);
      const { text: extracted } = await extractImg({
        data: { base64, mimeType: file.type || "image/png" },
      });
      if (extracted.trim().length < 20) {
        toast.error("No readable text found in the image.");
      } else {
        setText(extracted);
        toast.success("Transcribed screenshot — review below, then run analysis.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Image OCR failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleLookup() {
    if (companyQuery.trim().length < 2) {
      toast.error("Enter a company name or URL.");
      return;
    }
    setExtracting(true);
    try {
      const { text: extracted } = await lookup({ data: { query: companyQuery } });
      setText(extracted);
      if (!company) setCompany(companyQuery);
      toast.success("Loaded company brief — review below, then run analysis.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Lookup failed.";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 40) {
      toast.error("Need at least a few sentences before we can analyze.");
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await run({
        data: {
          sourceText: text,
          company: company || undefined,
          roleTitle: roleTitle || undefined,
          offeredSalary: offeredSalary || undefined,
          location: location || undefined,
          yearsExperience: yearsExperience || undefined,
          sessionId: getSessionId(),
        },
      });
      navigate({ to: "/report/$id", params: { id } });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.includes("429")) {
        toast.error("Rate limit reached — please wait a moment and try again.");
      } else if (msg.includes("402")) {
        toast.error("AI credits exhausted on this workspace.");
      } else {
        toast.error("Analysis failed. Try a shorter or simpler text.");
      }
      setSubmitting(false);
    }
  }

  const modeTabs: { id: Mode; label: string; icon: typeof Type }[] = [
    { id: "text", label: "Paste text", icon: Type },
    { id: "pdf", label: "Upload PDF", icon: FileText },
    { id: "image", label: "Screenshot", icon: ImageIcon },
    { id: "company", label: "Company URL", icon: Building2 },
  ];

  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20">
        <header className="mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink">
            <Sparkles size={12} /> Multi-agent analysis
          </span>
          <h1
            className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl text-ink"
            style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
          >
            Paste, drop, or look up. We&apos;ll read between the{" "}
            <span className="italic" style={{ color: "var(--heading-accent)" }}>
              lines.
            </span>
          </h1>
          <p className="mt-4 text-body max-w-2xl">
            Bring the job description, offer letter, recruiter screenshot, or
            just a company URL. Eight specialist agents analyze toxicity,
            burnout, salary fairness, ghost-hiring signals, and write the
            questions you should ask back.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8 shadow-sm"
        >
          {/* Mode tabs */}
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

          {/* Mode-specific input */}
          {mode === "pdf" && (
            <FileDrop
              accept="application/pdf"
              label={pdfName ?? "Drop a PDF offer letter or JD"}
              hint="Up to 12MB. We extract text on the server — file is not stored."
              busy={extracting}
              onFile={handlePdf}
            />
          )}
          {mode === "image" && (
            <FileDrop
              accept="image/png,image/jpeg,image/webp"
              label={imgName ?? "Drop a screenshot (PNG / JPG / WEBP)"}
              hint="Gemini Vision reads the text — recruiter chats, LinkedIn posts, anything."
              busy={extracting}
              onFile={handleImage}
            />
          )}
          {mode === "company" && (
            <div className="rounded-xl border border-ink/15 bg-cream/40 p-4">
              <label className="block text-sm font-medium text-ink mb-2">
                Company URL or name
              </label>
              <div className="flex gap-2">
                <input
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="acmecorp.com  or  Acme Corp"
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
                URLs are fetched and stripped to text. Plain company names use
                public-knowledge AI brief.
              </p>
            </div>
          )}

          <label className="mt-6 block text-sm font-medium text-ink mb-2">
            {mode === "text"
              ? "Job description / offer letter / HR chat"
              : "Extracted text (edit if needed)"}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "text"
                ? "Paste the full job posting here..."
                : "Extracted text will appear here..."
            }
            className="w-full min-h-[260px] rounded-xl border border-ink/15 bg-cream/40 px-4 py-3 text-sm text-ink font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-heading/40 focus:border-heading/40"
            required
          />

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company (optional)" value={company} onChange={setCompany} placeholder="Acme Corp" />
            <Field label="Role title (optional)" value={roleTitle} onChange={setRoleTitle} placeholder="Senior Engineer" />
            <Field label="Offered salary (optional)" value={offeredSalary} onChange={setOfferedSalary} placeholder="$120k base + equity" />
            <Field label="Location (optional)" value={location} onChange={setLocation} placeholder="Remote, US" />
            <Field label="Your years of experience (optional)" value={yearsExperience} onChange={setYearsExperience} placeholder="5" />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || extracting}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream transition-colors hover:bg-ink-hover disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing — 8 agents running…
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
                  toast("Loaded a sample toxic JD — submit to see the magic.");
                }}
                className="text-sm text-ink/70 hover:text-ink underline-offset-4 hover:underline"
              >
                Or load a sample
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-body/80">
            Analysis usually takes 10–20 seconds. We never share what you paste.
          </p>
        </form>
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
        dragging
          ? "border-heading bg-heading/5"
          : "border-ink/20 bg-cream/40 hover:bg-cream/60"
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

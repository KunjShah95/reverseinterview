import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import { runAnalysis } from "@/lib/analysis.functions";
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

export const Route = createFileRoute("/analyze")({
  validateSearch: z.object({ demo: z.number().optional() }),
  head: () => ({
    meta: [
      { title: "Analyze a job — Reverse Interview AI" },
      {
        name: "description",
        content:
          "Paste a job description or offer letter to get a multi-agent analysis: toxicity, burnout risk, salary fairness, and the questions you should ask back.",
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

function AnalyzePage() {
  const { demo } = Route.useSearch();
  const navigate = useNavigate();
  const run = useServerFn(runAnalysis);

  const [text, setText] = useState(demo ? DEMO_JD : "");
  const [company, setCompany] = useState(demo ? "Sample Startup Inc." : "");
  const [roleTitle, setRoleTitle] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [location, setLocation] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 40) {
      toast.error("Paste at least a few sentences of the job description.");
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
            Paste the job. We&apos;ll read between the{" "}
            <span className="italic" style={{ color: "var(--heading-accent)" }}>
              lines.
            </span>
          </h1>
          <p className="mt-4 text-body max-w-2xl">
            Drop the job description, offer letter, or HR chat. Eight specialist
            agents will analyze toxicity, burnout, salary fairness, ghost-hiring
            signals, and write the questions you should ask back.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-8 shadow-sm"
        >
          <label className="block text-sm font-medium text-ink mb-2">
            Job description / offer letter / HR chat
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job posting here..."
            className="w-full min-h-[260px] rounded-xl border border-ink/15 bg-cream/40 px-4 py-3 text-sm text-ink font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-heading/40 focus:border-heading/40"
            required
          />

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

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
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
            {!demo && (
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

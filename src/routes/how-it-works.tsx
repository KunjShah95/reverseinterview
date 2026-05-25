import { createFileRoute, Link } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "The Process — Reverse Interview AI" },
      {
        name: "description",
        content:
          "How eight specialist AI agents read a job posting and merge into one TruthScore verdict.",
      },
      { property: "og:title", content: "How Reverse Interview AI works" },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  {
    n: "01",
    title: "You paste the source",
    body: "A job post, an offer letter, an HR chat screenshot — anything written. We don't need to know who wrote it.",
  },
  {
    n: "02",
    title: "Eight agents read in parallel",
    body: "Culture, Burnout, Salary, Ghost-hiring, Negotiation, Reverse-Questions, HR-Lie-Detector, and a Simulation engine all analyze the same text simultaneously.",
  },
  {
    n: "03",
    title: "A senior reviewer merges them",
    body: "A final orchestrator agent reads every sub-report and produces one TruthScore, one verdict, and the top three risks and greens.",
  },
  {
    n: "04",
    title: "You get a report you can share",
    body: "Color-coded heatmap, copyable interview questions, a counter-offer template, and a 6mo/1yr/2yr simulation of what life there will feel like.",
  },
];

function HowItWorks() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <section className="mx-auto max-w-4xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-16">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          The{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            process.
          </span>
        </h1>
        <p className="mt-5 text-lg text-body max-w-2xl">
          A multi-agent pipeline that treats your decision the way companies treat
          theirs — with structured analysis, not vibes.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <article
              key={s.n}
              className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
            >
              <span className="font-mono text-xs text-ink/40">{s.n}</span>
              <h2 className="mt-2 font-display text-2xl text-ink">{s.title}</h2>
              <p className="mt-2 text-sm text-body leading-relaxed">{s.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-ink/10 bg-white p-6">
          <h2 className="font-display text-2xl text-ink">The eight agents</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-body">
            {[
              ["Culture / Toxicity", "Spots loaded phrases like 'rockstar', 'family', 'wear many hats' and explains their possible hidden meaning."],
              ["Burnout Predictor", "Scores overtime probability and stress signals."],
              ["Salary Analyst", "Compares the offer to market range with a confidence rating."],
              ["Ghost-hiring Detector", "Flags fake urgency, reposts, and vague scope."],
              ["Reverse-Question Generator", "Writes 8–12 sharp questions for you to ask back."],
              ["HR Lie Detector", "Finds claims contradicted elsewhere in the same text."],
              ["Negotiation Coach", "Drafts talking points, counter-offer, and red lines."],
              ["Join Simulation", "Predicts 6-month, 1-year, and 2-year experience."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg border border-ink/10 bg-cream/40 p-3">
                <p className="font-medium text-ink">{t}</p>
                <p className="mt-1 text-xs">{d}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
          >
            Analyze a job <ArrowRight size={14} />
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import {
  ShieldAlert,
  Flame,
  DollarSign,
  Search,
  MessageSquare,
  Scan,
  Handshake,
  Clock,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Reverse Interview AI" },
      {
        name: "description",
        content:
          "Eight specialist AI agents analyze toxicity, burnout, salary, ghost-hiring, and more from any job post or offer letter.",
      },
    ],
  }),
  component: Features,
});

const agents = [
  {
    title: "Culture / Toxicity",
    Icon: ShieldAlert,
    desc: "Flags loaded phrases like 'rockstar', 'family', 'hustle culture', and 'wear many hats' — then explains their possible hidden meaning.",
  },
  {
    title: "Burnout Predictor",
    Icon: Flame,
    desc: "Scores overtime probability, on-call signals, and turnover risk based on urgency language and scope clues.",
  },
  {
    title: "Salary Analyst",
    Icon: DollarSign,
    desc: "Compares the offer to estimated market range for the role, level, and location. Flags below-market or vague compensation.",
  },
  {
    title: "Ghost-hiring Detector",
    Icon: Search,
    desc: "Spots fake urgency, repeated repost patterns, vague responsibilities, and other signals of non-genuine hiring.",
  },
  {
    title: "Reverse Interview Coach",
    Icon: MessageSquare,
    desc: "Generates 8–12 sharp, non-generic questions the candidate should ask back — organized by category.",
  },
  {
    title: "HR Lie Detector",
    Icon: Scan,
    desc: "Finds claims in the text that contradict other parts of the same document — 'work-life balance' next to 'on-call rotations'.",
  },
  {
    title: "Negotiation Coach",
    Icon: Handshake,
    desc: "Drafts talking points, a counter-offer email template, and red-line items the candidate should not concede.",
  },
  {
    title: "Join Simulation",
    Icon: Clock,
    desc: "Predicts what 6 months, 1 year, and 2 years at the company would feel like — with stress, growth, and learning scores.",
  },
];

const otherFeatures = [
  {
    title: "Multi-input support",
    desc: "Paste text, upload a PDF, drop a screenshot (OCR), or enter a company URL to pull their about page and careers page automatically.",
  },
  {
    title: "Document type detection",
    desc: "The system classifies whether you pasted a job description, offer letter, recruiter chat, or company brief — and adjusts context accordingly.",
  },
  {
    title: "Live swarm progress",
    desc: "Each agent updates its status in real time. You open the report immediately and watch sections fill in as agents complete.",
  },
  {
    title: "TruthScore™ verdict",
    desc: "Five dimensions (transparency, work-life balance, career growth, hiring integrity, compensation fairness) rolled into one recommendation: proceed, caution, or avoid.",
  },
  {
    title: "PDF export",
    desc: "Export any completed report as a PDF to save, share, or bring to a recruiter conversation.",
  },
  {
    title: "Your dashboard",
    desc: "All your past analyses in one place with stats and quick access to re-open any report.",
  },
];

function Features() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <section className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          Eight agents.{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            One verdict.
          </span>
        </h1>
        <p className="mt-5 text-lg text-body max-w-2xl">
          Every job description, offer letter, or HR chat gets read by eight specialist AI agents in
          parallel. A senior reviewer merges their findings into a single TruthScore.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {agents.map(({ title, Icon, desc }) => (
            <article
              key={title}
              className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cream border border-ink/5">
                <Icon size={16} className="text-heading" />
              </span>
              <h2 className="mt-3 font-display text-xl text-ink">{title}</h2>
              <p className="mt-1 text-sm text-body leading-relaxed">{desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-16">
          <h2
            className="font-display text-3xl sm:text-4xl text-ink"
            style={{ letterSpacing: "-0.03em" }}
          >
            More features
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherFeatures.map(({ title, desc }) => (
              <div key={title} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
                <h3 className="font-display text-lg text-ink">{title}</h3>
                <p className="mt-1 text-sm text-body leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
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

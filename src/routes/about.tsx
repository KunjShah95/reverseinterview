import { createFileRoute, Link } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Reverse Interview AI" },
      {
        name: "description",
        content:
          "Reverse Interview AI helps candidates evaluate job offers with multi-agent analysis before signing.",
      },
      { property: "og:title", content: "About — Reverse Interview AI" },
      {
        property: "og:description",
        content:
          "Reverse Interview AI helps candidates evaluate job offers with multi-agent analysis before signing.",
      },
      { property: "og:image", content: "/og.svg" },
    ],
    links: [{ rel: "canonical", href: "https://reverseinterview.vercel.app/about" }],
  }),
  component: About,
});

function About() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid hideDashboard />
      <section className="mx-auto max-w-3xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20 text-center">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          About{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            Reverse Interview AI.
          </span>
        </h1>

        <div className="mt-10 space-y-6 text-body leading-relaxed text-left">
          <p>
            Reverse Interview AI was built to fix an asymmetric information problem: companies
            research candidates extensively, but candidates often walk into an offer blind. Job
            descriptions are marketing documents, not truth-telling instruments.
          </p>

          <p>
            We use a multi-agent AI system — eight specialist agents reading the same text in
            parallel, then merged by a senior reviewer — to surface the hidden signals behind hiring
            language. Toxicity cues, burnout language, salary fairness, ghost-hiring patterns,
            internal contradictions, and more.
          </p>

          <div className="rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="font-display text-xl text-ink">Our mission</h2>
            <p className="mt-2">
              Give every candidate the same analytical depth that companies apply to them.
            </p>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="font-display text-xl text-ink">Why the name?</h2>
            <p className="mt-2">
              In a traditional interview, the company asks the questions. Reverse Interview AI flips
              the script — the candidate becomes the analyst, using structured intelligence to
              evaluate the employer.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream hover:bg-ink-hover transition-colors"
          >
            Try it yourself <ArrowRight size={14} />
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

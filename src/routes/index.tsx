import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Play,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Flame,
  DollarSign,
  Search,
  MessageSquare,
  Scan,
  Handshake,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Layers,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import heroImg from "@/assets/hero.jpg";
import { getSession } from "@/lib/auth-functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Reverse Interview AI — interview the company before you join",
      },
      {
        name: "description",
        content:
          "Upload a job post, offer letter, or HR chat. Reverse Interview AI returns toxicity flags, burnout risk, salary fairness, fake-hiring signals, and the questions you should ask back.",
      },
      { property: "og:title", content: "Reverse Interview AI" },
      {
        property: "og:description",
        content:
          "The AI that interviews the company before you join. See what working there will actually feel like.",
      },
      { property: "og:image", content: "/og.jpg" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <main className="relative w-full min-h-screen bg-cream">
      {/* Hero image background */}
      <div className="absolute inset-0 -z-10">
        <img src={heroImg} alt="" className="h-full w-full object-cover" aria-hidden="true" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(245,241,232,0.35) 0%, rgba(245,241,232,0.05) 30%, rgba(31,42,29,0.25) 100%)",
          }}
        />
      </div>

      <SiteNav hideDashboard={true} />

      {/* Hero copy */}
      <section className="relative pt-28 sm:pt-32 md:pt-36 px-4 sm:px-6 md:px-10 max-w-7xl mx-auto text-center">
       
        <h1
          className="mt-6 text-ink font-display text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[4.75rem] xl:text-[5.5rem] leading-[0.95] max-w-5xl mx-auto"
          style={{ letterSpacing: "-0.035em" }}
        >
          Close the rift between offer letters{" "}
          <span className="italic font-normal" style={{ color: "var(--heading-accent)" }}>
            and reality.
          </span>
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-ink/80 leading-relaxed">
          Reverse Interview AI reads the job post, the offer, the HR chat — and tells you what
          working there will actually feel like, before you sign.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/sign-in/$"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream shadow-lg shadow-ink/20 ring-1 ring-cream/20 transition-colors hover:bg-ink-hover"
          >
            Sign in
          </Link>
          <Link
            to="/sign-up/$"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink/30 bg-cream/80 backdrop-blur-md px-6 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
          >
            Sign up
          </Link>
        </div>
      </section>

      {/* Stats/metrics */}
      <section className="mt-20 sm:mt-28 px-4 sm:px-6 md:px-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {(
            [
              { value: "8", label: "specialist agents", Icon: Sparkles },
              { value: "10+", label: "risk signals flagged", Icon: AlertTriangle },
              { value: "< 60s", label: "analysis time", Icon: TrendingUp },
              { value: "Zero", label: "data retention", Icon: CheckCircle },
            ] as const
          ).map(({ value, label, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6 text-center shadow-sm"
            >
              <Icon size={22} className="mx-auto text-heading" />
              <p className="mt-3 text-2xl sm:text-3xl font-display text-ink">{value}</p>
              <p className="mt-0.5 text-xs sm:text-sm text-body">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agents feature grid */}
      <section className="mt-20 sm:mt-28 px-4 sm:px-6 md:px-10 max-w-7xl mx-auto">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-md border border-ink/10 px-3.5 py-1.5 text-xs font-medium text-ink">
            <Layers size={12} />
            The agents
          </span>
          <h2
            className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl text-ink max-w-3xl mx-auto"
            style={{ letterSpacing: "-0.03em", lineHeight: 0.95 }}
          >
            Eight specialists,{" "}
            <span className="italic" style={{ color: "var(--heading-accent)" }}>
              one verdict.
            </span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-body max-w-xl mx-auto">
            Each agent reads the same text through a different lens. A senior reviewer merges
            everything into a single TruthScore.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {(
            [
              {
                title: "Culture / Toxicity",
                Icon: ShieldAlert,
                desc: "Flags loaded phrases like 'rockstar', 'family', 'hustle culture'.",
              },
              {
                title: "Burnout Predictor",
                Icon: Flame,
                desc: "Scores overtime probability, turnover risk, and stress signals.",
              },
              {
                title: "Salary Analyst",
                Icon: DollarSign,
                desc: "Compares offer to market range with confidence bands.",
              },
              {
                title: "Ghost-hiring Detector",
                Icon: Search,
                desc: "Flags fake urgency, vague scope, and repeated reposts.",
              },
              {
                title: "Reverse Questions",
                Icon: MessageSquare,
                desc: "Generates sharp questions to ask back in interviews.",
              },
              {
                title: "HR Lie Detector",
                Icon: Scan,
                desc: "Finds claims the text itself contradicts.",
              },
              {
                title: "Negotiation Coach",
                Icon: Handshake,
                desc: "Drafts talking points, counter-offers, and red lines.",
              },
              {
                title: "Join Simulation",
                Icon: Clock,
                desc: "Predicts 6mo / 1yr / 2yr experience at the company.",
              },
            ] as const
          ).map(({ title, Icon, desc }) => (
            <article
              key={title}
              className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cream border border-ink/5">
                <Icon size={15} className="text-heading" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-xs text-body leading-relaxed">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works steps */}
      <section className="mt-20 sm:mt-28 px-4 sm:px-6 md:px-10 max-w-6xl mx-auto">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-md border border-ink/10 px-3.5 py-1.5 text-xs font-medium text-ink">
            <Lightbulb size={12} />
            How it works
          </span>
          <h2
            className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl text-ink"
            style={{ letterSpacing: "-0.03em", lineHeight: 0.95 }}
          >
            From paste{" "}
            <span className="italic" style={{ color: "var(--heading-accent)" }}>
              to verdict.
            </span>
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-2">
          {[
            [
              "01",
              "Paste the source",
              "A job post, offer letter, or HR chat — anything written. We don't track who you are.",
            ],
            [
              "02",
              "Eight agents scan in parallel",
              "Culture, burnout, salary, ghost-hiring, negotiation, lie detection, and simulation all run at once.",
            ],
            [
              "03",
              "Senior reviewer merges",
              "A final orchestrator reads every sub-report and produces one TruthScore and verdict.",
            ],
            [
              "04",
              "You get a shareable report",
              "Color-coded heatmap, interview questions, a counter-offer template, and a 6mo-2yr simulation.",
            ],
          ].map(([num, title, desc]) => (
            <article
              key={num}
              className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6 shadow-sm"
            >
              <span className="font-mono text-xs text-ink/40">{num}</span>
              <h3 className="mt-1.5 font-display text-xl text-ink">{title}</h3>
              <p className="mt-1.5 text-sm text-body leading-relaxed">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom CTA block */}
      <section className="relative mt-16 mb-10 mx-auto max-w-2xl rounded-2xl bg-ink/70 backdrop-blur-md p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--heading-accent)" }}
          />
          <p className="text-sm font-medium text-cream uppercase tracking-wider">
            TruthScore<span className="opacity-60 text-xs align-super">™</span> engine
          </p>
        </div>
        <p className="text-cream/90 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          Eight specialist agents read the same offer in parallel — toxicity, burnout, salary
          fairness, ghost-hiring, HR claim verification — then a senior reviewer merges them into
          one verdict.
        </p>
        <div className="mt-6 flex justify-center items-center gap-3">
          <Link
            to="/how-it-works"
            className="shrink-0 text-sm font-medium text-cream hover:text-white underline underline-offset-4 transition-colors"
          >
            Know more →
          </Link>
        </div>
      </section>

      {/* Bottom-right "demo" link */}
      <div className="hidden sm:flex justify-end mt-6 mb-8 mx-4 sm:mx-6 md:mx-10">
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-3 text-ink/70 hover:text-ink transition-colors group shrink-0"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/10 backdrop-blur-md border border-ink/20 group-hover:bg-ink/20 transition-colors">
            <Play size={14} fill="currentColor" />
          </span>
          <span className="text-sm font-medium text-nowrap">See how it works</span>
          <span className="text-xs text-ink/50 shrink-0">0:15</span>
        </Link>
      </div>
    </main>
  );
}

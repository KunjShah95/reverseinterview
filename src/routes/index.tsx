import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, ArrowRight, Sparkles } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "Reverse Interview AI — interview the company before you join",
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
    <main className="relative w-full min-h-screen lg:h-screen overflow-hidden bg-cream">
      {/* Hero image background */}
      <div className="absolute inset-0 -z-10">
        <img
          src={heroImg}
          alt=""
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(245,241,232,0.35) 0%, rgba(245,241,232,0.05) 30%, rgba(31,42,29,0.25) 100%)",
          }}
        />
      </div>

      <SiteNav />

      {/* Hero copy */}
      <section className="relative pt-28 sm:pt-32 md:pt-36 px-4 sm:px-6 md:px-10 max-w-7xl mx-auto">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-md border border-white/60 px-3.5 py-1.5 text-xs font-medium text-ink">
          <Sparkles size={12} />
          Multi-agent analysis · powered by Lovable AI
        </span>
        <h1
          className="mt-6 text-ink font-display text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[4.75rem] xl:text-[5.5rem] leading-[0.95] max-w-5xl"
          style={{ letterSpacing: "-0.035em" }}
        >
          Close the rift between offer letters{" "}
          <span
            className="italic font-normal"
            style={{ color: "var(--heading-accent)" }}
          >
            and reality.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-base sm:text-lg text-ink/80 leading-relaxed">
          Reverse Interview AI reads the job post, the offer, the HR chat — and
          tells you what working there will actually feel like, before you sign.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream shadow-lg shadow-ink/20 ring-1 ring-cream/20 transition-colors hover:bg-ink-hover"
          >
            Analyze a job
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/analyze"
            search={{ demo: 1 }}
            className="inline-flex items-center gap-2 rounded-full border border-ink/30 bg-cream/80 backdrop-blur-md px-6 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
          >
            See sample report
          </Link>
        </div>
      </section>

      {/* Bottom-left CTA block — flows in document on mobile, absolute on lg+ */}
      <section className="relative mt-16 mb-10 mx-4 sm:mx-6 md:mx-10 lg:absolute lg:mt-0 lg:mb-0 lg:left-10 lg:right-auto lg:bottom-10 max-w-md rounded-2xl lg:rounded-none bg-ink/70 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none p-5 lg:p-0">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--heading-accent)" }}
          />
          <p className="text-sm font-medium text-cream">
            TruthScore<span className="opacity-60 text-xs align-super">™</span>{" "}
            engine
          </p>
        </div>
        <p className="text-cream/90 text-sm md:text-base leading-relaxed">
          Eight specialist agents read the same offer in parallel — toxicity,
          burnout, salary fairness, ghost-hiring, HR claim verification — then
          a senior reviewer merges them into one verdict.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/analyze"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-cream transition-colors"
            style={{ backgroundColor: "var(--cta)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--cta-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--cta)")
            }
          >
            Try it Live
          </Link>
          <Link
            to="/how-it-works"
            className="text-sm text-cream/90 hover:text-cream underline-offset-4 hover:underline transition-colors"
          >
            Know more →
          </Link>
        </div>
      </section>

      {/* Bottom-right "demo" link */}
      <Link
        to="/analyze"
        search={{ demo: 1 }}
        className="hidden sm:flex absolute right-6 md:right-10 bottom-8 md:bottom-10 items-center gap-3 text-cream/90 hover:text-cream transition-colors group"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 group-hover:bg-white/30 transition-colors">
          <Play size={14} fill="currentColor" />
        </span>
        <span className="text-sm font-medium">See it work</span>
        <span className="text-xs text-cream/60">0:15</span>
      </Link>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Tariffs — Reverse Interview AI" },
      {
        name: "description",
        content:
          "Free during the hackathon. Future plans for individuals, talent advisors, and teams.",
      },
      { property: "og:title", content: "Tariffs — Reverse Interview AI" },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    name: "Free",
    price: "$0",
    blurb: "Everything during the hackathon.",
    features: ["Unlimited analyses", "All 8 agents", "Shareable reports"],
    cta: "Start analyzing",
  },
  {
    name: "Advisor",
    price: "$19/mo",
    blurb: "For coaches and recruiters supporting candidates.",
    features: ["Branded reports", "Saved company library", "PDF export"],
    cta: "Notify me",
    soon: true,
  },
  {
    name: "Team",
    price: "Custom",
    blurb: "For talent partners and bootcamps.",
    features: ["Bulk analyses", "API access", "Cohort dashboards"],
    cta: "Talk to us",
    soon: true,
  },
];

function Pricing() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid />
      <section className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          Free while we&apos;re{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            new.
          </span>
        </h1>
        <p className="mt-5 text-lg text-body max-w-2xl">
          Honest signals about employers shouldn&apos;t be locked behind a paywall.
          Use it, share it, tell us what to build next.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm flex flex-col"
            >
              <p className="text-sm font-medium text-ink/60">{t.name}</p>
              <p className="mt-1 font-display text-4xl text-ink">{t.price}</p>
              <p className="mt-2 text-sm text-body">{t.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm text-body flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2 items-start">
                    <Check size={16} className="mt-0.5 text-heading shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/analyze"
                className={`mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  t.soon
                    ? "border border-ink/15 text-ink hover:bg-ink/5"
                    : "bg-ink text-cream hover:bg-ink-hover"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

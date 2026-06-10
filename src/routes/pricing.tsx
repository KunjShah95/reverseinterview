import { createFileRoute, Link } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Check, Sparkles, Shield, Download, Smartphone } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Reverse Interview AI" },
      {
        name: "description",
        content:
          "Reverse Interview AI is free. No credit card, no limits, no tricks.",
      },
      { property: "og:title", content: "Pricing — Reverse Interview AI" },
    ],
  }),
  component: Pricing,
});

const features = [
  "All 10 AI agents",
  "Unlimited analyses",
  "Shareable reports",
  "PDF export",
  "Firestore cloud saves",
  "Dashboard & history",
  "Google OAuth sign-in",
  "No credit card required",
];

function Pricing() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid hideDashboard />
      <section className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm">
          <Sparkles size={12} /> Forever free
        </span>
        <h1
          className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          Free for{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            everyone.
          </span>
        </h1>
        <p className="mt-5 text-lg text-body max-w-2xl mx-auto">
          Honest signals about employers shouldn&apos;t be locked behind a paywall.
          Every feature, every agent, every report — free, no limits.
        </p>

        <div className="mt-12 mx-auto max-w-md">
          <div className="rounded-[2.5rem] border-2 border-ink/10 bg-white p-8 shadow-lg">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-cream">
                <Sparkles size={16} />
              </span>
            </div>
            <p className="font-display text-6xl text-ink" style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}>
              $0
            </p>
            <p className="mt-2 text-sm text-body">per month · unlimited everything</p>

            <ul className="mt-6 space-y-3 text-left">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-ink">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <Check size={12} className="text-green-700" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to="/analyze"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-cream shadow-sm transition-colors hover:bg-ink-hover"
            >
              Start analyzing for free
            </Link>
            <p className="mt-3 text-xs text-body/70">
              No account required to try it. Sign up to save reports to the cloud.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
          <FeatureCard
            icon={Shield}
            title="No data retention"
            desc="We don't store what you paste. Reports live in your account."
          />
          <FeatureCard
            icon={Download}
            title="PDF export"
            desc="Download any report as a polished PDF with cover page."
          />
          <FeatureCard
            icon={Smartphone}
            title="Works on any device"
            desc="Mobile-friendly dashboard, history, and report reader."
          />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Sparkles;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5 text-left shadow-sm">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cream border border-ink/5">
        <Icon size={16} className="text-heading" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-xs text-body leading-relaxed">{desc}</p>
    </div>
  );
}

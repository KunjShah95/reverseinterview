import { createFileRoute } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Mail, MessageSquare, Github } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Reverse Interview AI" },
      {
        name: "description",
        content: "Get in touch with the Reverse Interview AI team.",
      },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid hideDashboard />
      <section className="mx-auto max-w-3xl px-4 sm:px-6 md:px-10 pt-28 sm:pt-32 pb-20 text-center">
        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl text-ink"
          style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
        >
          Get in{" "}
          <span className="italic" style={{ color: "var(--heading-accent)" }}>
            touch.
          </span>
        </h1>
        <p className="mt-5 text-lg text-body max-w-xl mx-auto">
          Questions, feedback, or feature requests? We read everything.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
          <a
            href="mailto:support@example.com"
            className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm hover:border-ink/30 transition-colors"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cream border border-ink/5">
              <Mail size={18} className="text-heading" />
            </span>
            <div>
              <p className="font-medium text-ink">Email</p>
              <p className="text-sm text-body">support@example.com</p>
            </div>
          </a>

          <a
            href="#"
            className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm hover:border-ink/30 transition-colors"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cream border border-ink/5">
              <MessageSquare size={18} className="text-heading" />
            </span>
            <div>
              <p className="font-medium text-ink">Discord</p>
              <p className="text-sm text-body">Join our community</p>
            </div>
          </a>

          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm hover:border-ink/30 transition-colors"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cream border border-ink/5">
              <Github size={18} className="text-heading" />
            </span>
            <div>
              <p className="font-medium text-ink">GitHub</p>
              <p className="text-sm text-body">View on GitHub</p>
            </div>
          </a>
        </div>

        <div className="mt-12 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-ink">Report a problem</h2>
          <p className="mt-2 text-sm text-body">
            If you encountered a bug, got a misleading analysis, or something didn't work right,
            please open an issue on GitHub or send us an email. We respond within 24 hours.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

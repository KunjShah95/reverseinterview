import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import { getSession } from "@/lib/auth-functions";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session.authenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Create an account — Reverse Interview AI" },
      {
        name: "description",
        content: "Create an account to save your reports and access your dashboard.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteNav solid hideDashboard />
      <div className="flex items-center justify-center pt-28 sm:pt-32 pb-20 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 font-display text-xl text-ink mb-4">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-cream text-xs">
                  ✦
                </span>
                ReverseHire<sup className="text-[10px] opacity-40">™</sup>
              </div>
              <h1 className="font-display text-3xl text-ink" style={{ letterSpacing: "-0.03em" }}>
                Create your account
              </h1>
              <p className="mt-1 text-sm text-body">
                Start with the Clerk sign-up flow to save your analysis history and get personalized recommendations.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                to="/sign-up/$"
                className="flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
              >
                Open Clerk sign up
              </Link>
              <Link
                to="/sign-in/$"
                className="flex w-full items-center justify-center rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream/50"
              >
                I already have an account
              </Link>
            </div>
            <p className="mt-6 text-xs text-center text-body/70">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>

            <div className="mt-6 pt-5 border-t border-ink/10 text-center text-sm text-body">
              Already have an account?{" "}
              <Link to="/sign-in/$" className="text-heading font-medium underline">
                Sign in with Clerk
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

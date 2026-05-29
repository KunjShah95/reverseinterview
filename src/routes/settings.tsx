import { UserProfile } from "@clerk/tanstack-react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import SiteNav from "@/components/SiteNav";
import { getSession } from "@/lib/auth-functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Reverse Interview AI" },
      { name: "description", content: "Manage your account settings and profile." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session"],
    queryFn: () => fetchSession(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!sessionLoading && session && !session.authenticated) {
      navigate({ to: "/login" });
    }
  }, [session, sessionLoading, navigate]);

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-paper lg:pl-72">
        <DashboardSidebar />
        <div className="lg:hidden">
          <SiteNav solid />
        </div>
        <div className="flex items-center justify-center pt-36 text-body">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading settings…
        </div>
      </main>
    );
  }

  if (!session?.authenticated) return null;

  return (
    <main className="min-h-screen bg-paper lg:pl-72">
      <DashboardSidebar />
      <div className="lg:hidden">
        <SiteNav solid />
      </div>
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32 md:px-10">
        <header className="mb-8">
          <h1
            className="font-display text-4xl text-ink sm:text-5xl"
            style={{ letterSpacing: "-0.035em", lineHeight: 0.95 }}
          >
            Settings.
          </h1>
          <p className="mt-3 text-body">
            Manage your account details, security, and linked profiles through Clerk.
          </p>
        </header>

        <div className="rounded-[2rem] border border-ink/10 bg-white overflow-hidden shadow-sm">
          <UserProfile routing="hash" />
        </div>
      </div>
    </main>
  );
}

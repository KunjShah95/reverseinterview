import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import SiteNav from "@/components/SiteNav";
import { useFirebaseAuth } from "@/lib/firebase-auth";

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
  const { user, loading, updateDisplayName, sendPasswordReset, signOut } = useFirebaseAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.displayName ?? "");
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, navigate, user]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    setResetting(true);
    setError(null);
    try {
      await sendPasswordReset(user?.email ?? "");
      setError("Password reset email sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
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

  if (!user) return null;

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
          <p className="mt-3 text-body">Manage your Firebase account details and display name.</p>
        </header>

        <div className="rounded-[2rem] border border-ink/10 bg-white overflow-hidden shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-body/70">Account</p>
            <p className="mt-2 text-lg font-semibold text-ink">{user.displayName ?? "Firebase user"}</p>
            <p className="text-sm text-body">{user.email ?? "No email available"}</p>
            <p className="mt-1 text-xs text-body/70 break-all">UID: {user.uid}</p>
          </div>

          <div className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Display name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-ink/30"
                placeholder="Your name"
              />
            </label>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink-hover disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save display name"}
              </button>
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                disabled={resetting}
                className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-cream/50 disabled:opacity-60"
              >
                {resetting ? "Sending…" : "Reset password"}
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center justify-center rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-cream/50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Chrome } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase-auth";

type Mode = "signIn" | "signUp";

type Props = {
  mode: Mode;
};

export default function FirebaseAuthCard({ mode }: Props) {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp, signInWithGoogle, sendPasswordReset } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/dashboard" });
    }
  }, [loading, navigate, user]);

  const heading = mode === "signIn" ? "Welcome back" : "Create your account";
  const description =
    mode === "signIn"
      ? "Use Firebase Authentication to access your dashboard and saved reports."
      : "Create your Firebase account to save reports and keep your analysis history.";

  const actionLabel = mode === "signIn" ? "Sign in" : "Create account";
  const swapHref = mode === "signIn" ? "/register" : "/login";
  const swapLabel = mode === "signIn" ? "Need an account?" : "Already have an account?";
  const swapCta = mode === "signIn" ? "Sign up" : "Sign in";
  const [resetingPassword, setResetingPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!email.trim() || password.length < 6) return false;
    return true;
  }, [email, password.length]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, displayName.trim() || undefined);
      }
      void navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      void navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleResetPassword() {
    setResetingPassword(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setError("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setResetingPassword(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="flex items-center justify-center px-4 pb-20 pt-28 sm:pt-32">
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
                {heading}
              </h1>
              <p className="mt-1 text-sm text-body">{description}</p>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={loading || googleBusy}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream/50 disabled:opacity-60"
            >
              {googleBusy ? <Loader2 size={16} className="animate-spin" /> : <Chrome size={16} />}
              Continue with Google
            </button>

            <div className="mb-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-body/60">
              <span className="h-px flex-1 bg-ink/10" />
              or email
              <span className="h-px flex-1 bg-ink/10" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signUp" && (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">Display name</span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-body/50 focus:border-ink/30"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-body/50 focus:border-ink/30"
                  autoComplete="email"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-body/50 focus:border-ink/30"
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                />
              </label>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {mode === "signIn" && (
                <button
                  type="button"
                  onClick={() => void handleResetPassword()}
                  disabled={resetingPassword || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream/40 disabled:opacity-60"
                >
                  {resetingPassword ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting || loading}
                className="flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-cream transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                {actionLabel}
              </button>
            </form>

            <p className="mt-6 text-xs text-center text-body/70">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>

            <div className="mt-6 pt-5 border-t border-ink/10 text-center text-sm text-body">
              {swapLabel}{" "}
              <Link to={swapHref} className="text-heading font-medium underline">
                {swapCta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { postOAuthSignIn } from "@/lib/supabase-oauth.server";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [message, setMessage] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user ?? null;
        if (!user || !user.email) {
          setMessage("Sign-in failed: no user email available.");
          return;
        }

        // Call server to enforce single-account-per-email policy
        const res = await postOAuthSignIn({ data: { userId: user.id, email: user.email } });
        if (!res.ok) {
          // Duplicate detected. Provide instructions to link the provider to the existing account.
          const dupId = (res as unknown as { duplicateUserId?: string }).duplicateUserId ?? "";
          setDuplicateId(dupId || null);
          const provider = "google";
          const linkUrl = `/link-provider?duplicateId=${encodeURIComponent(dupId)}&provider=${encodeURIComponent(provider)}`;
          setMessage(
            `An account with this email already exists. To link this provider to your original account: sign in to your original account, then open ${linkUrl} and click Link.`,
          );
          return;
        }

        setMessage("Sign-in successful. You can now continue.");
        // Redirect to app home after brief delay
        setTimeout(() => (window.location.href = "/"), 1200);
      } catch (err: unknown) {
        console.error(err);
        const msg =
          err && typeof err === "object" && "message" in err
            ? ((err as { message?: unknown }).message as string | undefined)
            : String(err);
        setMessage(msg ?? "Unexpected error during sign-in.");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="rounded-lg border p-8 bg-cream/60 max-w-xl">
        <h2 className="text-lg font-semibold mb-3">Completing sign-in…</h2>
        <p>{message ?? "Working…"}</p>
        {duplicateId && (
          <div className="mt-4 rounded bg-white/80 p-3 border">
            <p className="text-sm mb-2">
              Duplicate OAuth user ID (share with support if you need help):
            </p>
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 rounded bg-cream/40 text-xs">{duplicateId}</code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(duplicateId);
                }}
                className="rounded border px-3 py-1 text-xs"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-body/80">
              If you can't link the provider, contact support and provide the duplicate ID above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

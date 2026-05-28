import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { linkProviderToExisting } from "@/lib/supabase-oauth.server";

export const Route = createFileRoute("/link-provider")({
  validateSearch: z.object({
    duplicateId: z.string().optional(),
    provider: z.string().optional(),
  }),
  component: LinkProvider,
});

function LinkProvider() {
  const { duplicateId = "", provider = "google" } = Route.useSearch();
  const [status, setStatus] = useState<string | null>(null);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Linking provider…");
    try {
      const res = await linkProviderToExisting({
        data: { duplicateUserId: duplicateId, provider },
      });
      const typed = res as unknown as { ok?: boolean; message?: string };
      if (typed.ok) {
        setStatus("Provider linked successfully. You may now sign in with this provider.");
        setTimeout(() => (window.location.href = "/"), 1200);
        return;
      }
      setStatus(typed.message ?? "Failed to link provider.");
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err && typeof err === "object" && "message" in err
          ? ((err as { message?: unknown }).message as string | undefined)
          : String(err);
      setStatus(msg ?? String(err));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="rounded-lg border p-8 bg-cream/60 max-w-xl">
        <h2 className="text-lg font-semibold mb-3">Link OAuth provider</h2>
        <p className="mb-4 text-sm">
          To link this OAuth provider to your existing account, please sign in to your original
          account (in this browser) first. Then come back to this page and click Link.
        </p>
        <form onSubmit={handleLink}>
          <div className="mb-3 text-xs text-body">
            <label className="block font-medium">Duplicate OAuth User ID</label>
            <input
              value={duplicateId}
              readOnly
              className="w-full rounded border px-3 py-2 mt-1 bg-white text-sm"
            />
          </div>
          <div className="mb-3 text-xs text-body">
            <label className="block font-medium">Provider</label>
            <input
              value={provider}
              readOnly
              className="w-full rounded border px-3 py-2 mt-1 bg-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-ink px-4 py-2 text-cream">
              Link
            </button>
            <a href="/" className="rounded border px-4 py-2">
              Cancel
            </a>
          </div>
        </form>
        {status && <p className="mt-4 text-sm">{status}</p>}
        <div className="mt-4 text-xs text-body/80">
          <p>
            If linking fails, contact support and provide the duplicate ID above so we can assist.
          </p>
        </div>
      </div>
    </div>
  );
}

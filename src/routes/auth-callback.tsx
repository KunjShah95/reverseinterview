import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallback,
});

function AuthCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-ink/10 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Legacy sign-in callback</h2>
        <p className="mt-2 text-sm text-body">
          Clerk now handles authentication directly, so this page is no longer used.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/sign-in/$"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream"
          >
            Open sign in
          </Link>
          <Link
            to="/"
            className="rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

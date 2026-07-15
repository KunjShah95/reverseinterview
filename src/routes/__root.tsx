import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { getAbsoluteUrl, getSiteUrl } from "@/lib/site-url";
import "@/lib/firebase";
import { FirebaseAuthProvider } from "@/lib/firebase-auth";

import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-light text-ink">404</h1>
        <h2 className="mt-4 text-xl font-medium text-ink">Page not found</h2>
        <p className="mt-2 text-sm text-body">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

NotFoundComponent.head = () => ({
  meta: [{ title: "Page Not Found — Reverse Interview AI" }],
});

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-medium tracking-tight text-ink">This page didn't load</h1>
        <p className="mt-2 text-sm text-body">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-ink/20 bg-transparent px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f5f1e8" },
      { title: "Reverse Interview AI — interview the company before you join" },
      {
        name: "description",
        content:
          "Paste a job description, offer letter, or HR chat. Reverse Interview AI tells you what working there will actually feel like — toxicity flags, burnout risk, salary fairness, and the questions you should be asking.",
      },
      { name: "author", content: "Reverse Interview AI" },
      { property: "og:title", content: "Reverse Interview AI" },
      {
        property: "og:description",
        content:
          "The AI that interviews the company before you join. Toxicity, burnout, salary, and ghost-hiring signals from any job post or offer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@reverseinterview" },
      { property: "og:locale", content: "en_US" },
      { property: "og:site_name", content: "Reverse Interview AI" },
      { property: "og:url", content: getSiteUrl() },
      { property: "og:image", content: getAbsoluteUrl("/og.svg") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: getAbsoluteUrl("/og.svg") },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: getSiteUrl() },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* JSON-LD structured data for basic organization info */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Reverse Interview AI",
              url: getSiteUrl(),
              logo: getAbsoluteUrl("/favicon.svg"),
              sameAs: [
                "https://twitter.com/reverseinterview",
              ],
              description:
                "AI-powered job offer analysis. Upload a job post, offer letter, or HR chat. Get toxicity flags, burnout risk, salary fairness, and ghost-hiring signals.",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Reverse Interview AI",
              url: getSiteUrl(),
              description:
                "AI-powered job offer analysis. Upload a job post, offer letter, or HR chat. Get toxicity flags, burnout risk, salary fairness, and ghost-hiring signals.",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${getSiteUrl()}/analyze`,
                },
                query: "required",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Reverse Interview AI",
              url: getSiteUrl(),
              description:
                "AI-powered job offer analysis. Upload a job post, offer letter, or HR chat. Get toxicity flags, burnout risk, salary fairness, and ghost-hiring signals.",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
      </head>
      <body>
        <FirebaseAuthProvider>
          <a
            href="#main"
            className="skip-link sr-only focus:not-sr-only absolute left-4 top-4 z-50 rounded-sm bg-white px-2 py-1 text-sm"
          >
            Skip to content
          </a>
          {children}
          <Scripts />
        </FirebaseAuthProvider>
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
      <Analytics />
    </QueryClientProvider>
  );
}

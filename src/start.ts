import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { consumeLastCapturedError } from "./lib/error-capture";

// Session cookie name can be overridden with SESSION_COOKIE_NAME env var
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "__session";

const sessionRedirectMiddleware = createMiddleware().server(async ({ request, next }) => {
  try {
    // Only redirect for top-level GET navigations that accept HTML
    if (request.method !== "GET") return await next();

    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html")) return await next();

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Don't redirect the landing page itself, API routes, or static/assets
    if (
      pathname === "/" ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/assets") ||
      pathname.startsWith("/public") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/_")
    ) {
      return await next();
    }

    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes(`${SESSION_COOKIE_NAME}=`)) {
      // No session cookie -> send visitor to landing page
      return Response.redirect(`${url.origin}/`, 302);
    }

    return await next();
  } catch (err) {
    console.error("sessionRedirectMiddleware error:", err);
    return await next();
  }
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Treat both `status` (common) and `statusCode` (some libraries) as HTTP errors
    if (error != null && typeof error === "object" && ("status" in error || "statusCode" in error)) {
      throw error;
    }

    // Log the thrown error and any out-of-band captured error (helps when h3/swallowed stacks)
    const original = consumeLastCapturedError();
    console.error("Unhandled error in request middleware:", error, original ?? "(no captured error)");
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [sessionRedirectMiddleware, clerkMiddleware(), errorMiddleware],
}));

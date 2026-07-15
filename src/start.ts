import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { consumeLastCapturedError } from "./lib/error-capture";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Treat both `status` (common) and `statusCode` (some libraries) as HTTP errors
    if (
      error != null &&
      typeof error === "object" &&
      ("status" in error || "statusCode" in error)
    ) {
      throw error;
    }

    // Log the thrown error and any out-of-band captured error (helps when h3/swallowed stacks)
    const original = consumeLastCapturedError();
    console.error(
      "Unhandled error in request middleware:",
      error,
      original ?? "(no captured error)",
    );
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));

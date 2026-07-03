import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    // Rethrow control-flow throws so the framework can handle them:
    // - Response instances (auth 401s, redirects) used by server fns
    // - TanStack redirect objects and any error with a status/statusCode
    if (error instanceof Response) throw error;
    if (
      error != null &&
      typeof error === "object" &&
      ("statusCode" in error || "status" in error || "isRedirect" in error)
    ) {
      throw error;
    }
    // Do NOT swallow server function or API errors with an HTML page —
    // the RPC client expects JSON/text and would otherwise fail parsing.
    const url = request?.url ? new URL(request.url) : null;
    const path = url?.pathname ?? "";
    if (path.startsWith("/_serverFn") || path.startsWith("/api/")) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));

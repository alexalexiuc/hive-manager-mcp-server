import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { SPREADSHEET_ID_HEADER } from "./constants.js";
import { createMcpServer } from "./server.js";
import type { Env } from "./types.js";

const VERSION = "1.0.0";

function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function logRequest(requestId: string, request: Request): void {
  const url = new URL(request.url);
  console.info(`[${requestId}] -> ${request.method} ${url.pathname}`);
}

function logResponse(
  requestId: string,
  request: Request,
  response: Response,
  durationMs: number,
): void {
  const url = new URL(request.url);
  console.info(
    `[${requestId}] <- ${response.status} ${request.method} ${url.pathname} (${durationMs}ms)`,
  );
}

function logError(requestId: string, request: Request, error: unknown): void {
  const url = new URL(request.url);
  if (error instanceof Error) {
    console.error(
      `[${requestId}] !! ${request.method} ${url.pathname} failed: ${error.message}`,
    );
    if (error.stack) {
      console.error(error.stack);
    }
    return;
  }

  console.error(
    `[${requestId}] !! ${request.method} ${url.pathname} failed with non-Error`,
    error,
  );
}

function toErrorPayload(error: unknown): {
  error: string;
  error_type?: string;
  details?: string;
} {
  if (error instanceof Error) {
    return {
      error: "Request failed",
      error_type: error.name,
      details: error.message,
    };
  }

  return {
    error: "Request failed",
    details: typeof error === "string" ? error : "Unknown error",
  };
}

function withRequestSpreadsheetId(env: Env, request: Request): Env {
  const spreadsheetId = request.headers.get(SPREADSHEET_ID_HEADER) ?? undefined;
  return {
    ...env,
    REQUEST_SPREADSHEET_ID: spreadsheetId,
  };
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/health" && request.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        server: "hive-manager-mcp-server",
        version: VERSION,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (url.pathname === "/mcp" && request.method === "POST") {
    const requestScopedEnv = withRequestSpreadsheetId(env, request);
    const server = createMcpServer(requestScopedEnv);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);

    return transport.handleRequest(request);
  }

  return new Response("Not Found", { status: 404 });
}

// Cloudflare Workers export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = createRequestId();
    const startedAt = Date.now();
    logRequest(requestId, request);

    try {
      const response = await handleRequest(request, env);
      logResponse(requestId, request, response, Date.now() - startedAt);
      return response;
    } catch (error: unknown) {
      logError(requestId, request, error);
      const url = new URL(request.url);
      const errorPayload = toErrorPayload(error);

      const response = new Response(
        JSON.stringify({
          ...errorPayload,
          request_id: requestId,
          method: request.method,
          path: url.pathname,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );

      logResponse(requestId, request, response, Date.now() - startedAt);
      return response;
    }
  },
};

// Node.js HTTP server fallback
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  console.log(`Starting hive-manager-mcp-server on port ${port}...`);
}

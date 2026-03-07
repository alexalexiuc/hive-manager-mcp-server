import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./server.js";
import type { Env } from "./types.js";

const VERSION = "1.0.0";

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
    const server = createMcpServer(env);

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
    return handleRequest(request, env);
  },
};

// Node.js HTTP server fallback
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  console.log(`Starting hive-manager-mcp-server on port ${port}...`);
}

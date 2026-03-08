import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { SPREADSHEET_ID_HEADER } from './constants.js';
import { createMcpServer } from './server.js';
import type { Env } from './types.js';

const VERSION = '1.0.0';

type RouteHandler = (request: Request, env: Env) => Promise<Response>;

interface RouteDefinition {
  method: string;
  path: string;
  isPublic: boolean;
  handler: RouteHandler;
}

interface RequestContext {
  request: Request;
  env: Env;
  requestId: string;
  startedAt: number;
  url: URL;
  route?: RouteDefinition;
}

type WorkerHandler = (context: RequestContext) => Promise<Response>;

const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/health',
    isPublic: true,
    handler: handleHealthRequest,
  },
  { method: 'POST', path: '/mcp', isPublic: false, handler: handleMcpRequest },
];

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
  durationMs: number
): void {
  const url = new URL(request.url);
  console.info(
    `[${requestId}] <- ${response.status} ${request.method} ${url.pathname} (${durationMs}ms)`
  );
}

function logError(requestId: string, request: Request, error: unknown): void {
  const url = new URL(request.url);
  if (error instanceof Error) {
    console.error(
      `[${requestId}] !! ${request.method} ${url.pathname} failed: ${error.message}`
    );
    if (error.stack) {
      console.error(error.stack);
    }
    return;
  }

  console.error(
    `[${requestId}] !! ${request.method} ${url.pathname} failed with non-Error`,
    error
  );
}

function toErrorPayload(error: unknown): {
  error: string;
  error_type?: string;
  details?: string;
} {
  if (error instanceof Error) {
    return {
      error: 'Request failed',
      error_type: error.name,
      details: error.message,
    };
  }

  return {
    error: 'Request failed',
    details: typeof error === 'string' ? error : 'Unknown error',
  };
}

function isAuthorized(request: Request, env: Env): boolean {
  const apiKey = env.AUTH_API_KEY;
  if (!apiKey) {
    return false;
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }
  const [scheme, provided] = authHeader.split(' ');
  if (scheme.toLowerCase() !== 'bearer' || !provided) {
    return false;
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(apiKey);
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

function withRequestSpreadsheetId(env: Env, request: Request): Env {
  const spreadsheetId = request.headers.get(SPREADSHEET_ID_HEADER) ?? undefined;
  return {
    ...env,
    REQUEST_SPREADSHEET_ID: spreadsheetId,
  };
}

function getRoute(
  request: Request,
  pathname: string
): RouteDefinition | undefined {
  return routes.find(
    (route) => route.method === request.method && route.path === pathname
  );
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate':
        'Bearer error="invalid_token", error_description="Unauthorized"',
    },
  });
}

function internalErrorResponse(
  context: RequestContext,
  error: unknown
): Response {
  const errorPayload = toErrorPayload(error);
  return new Response(
    JSON.stringify({
      ...errorPayload,
      request_id: context.requestId,
      method: context.request.method,
      path: context.url.pathname,
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function withRouteResolution(next: WorkerHandler): WorkerHandler {
  return async (context) => {
    context.route = getRoute(context.request, context.url.pathname);
    return next(context);
  };
}

function withAuthorization(next: WorkerHandler): WorkerHandler {
  return async (context) => {
    if (context.route?.isPublic) {
      return next(context);
    }

    if (!isAuthorized(context.request, context.env)) {
      console.warn(
        `[${context.requestId}] AUTH ${context.request.method} ${context.url.pathname} - unauthorized`
      );
      return unauthorizedResponse();
    }

    return next(context);
  };
}

function withRequestLogging(next: WorkerHandler): WorkerHandler {
  return async (context) => {
    logRequest(context.requestId, context.request);
    try {
      const response = await next(context);
      logResponse(
        context.requestId,
        context.request,
        response,
        Date.now() - context.startedAt
      );
      return response;
    } catch (error: unknown) {
      logError(context.requestId, context.request, error);
      const response = internalErrorResponse(context, error);
      logResponse(
        context.requestId,
        context.request,
        response,
        Date.now() - context.startedAt
      );
      return response;
    }
  };
}

async function routeRequest(context: RequestContext): Promise<Response> {
  if (!context.route) {
    return new Response('Not Found', { status: 404 });
  }

  return context.route.handler(context.request, context.env);
}

async function handleHealthRequest(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'ok',
      server: 'hive-manager-mcp-server',
      version: VERSION,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  const requestScopedEnv = withRequestSpreadsheetId(env, request);
  const server = createMcpServer(requestScopedEnv);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

const handler = withRequestLogging(
  withAuthorization(withRouteResolution(routeRequest))
);

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handler({
      request,
      env,
      requestId: createRequestId(),
      startedAt: Date.now(),
      url: new URL(request.url),
    });
  },
};

export default worker;

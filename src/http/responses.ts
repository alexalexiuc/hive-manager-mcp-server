import type { RequestContext } from './types.js';

export function toErrorPayload(error: unknown): {
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

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate':
        'Bearer error="invalid_token", error_description="Unauthorized"',
    },
  });
}

export function notFoundResponse(context: RequestContext): Response {
  return new Response(
    JSON.stringify({
      error: 'Not Found',
      request_id: context.requestId,
      method: context.request.method,
      path: context.url.pathname,
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export function internalErrorResponse(
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

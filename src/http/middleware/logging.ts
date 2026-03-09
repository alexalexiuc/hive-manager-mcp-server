import { internalErrorResponse } from '../responses';
import type { WorkerHandler } from '../types';

export function createRequestId(): string {
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

export function withRequestLogging(next: WorkerHandler): WorkerHandler {
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

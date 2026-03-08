import type { Env } from '../../types.js';
import { unauthorizedResponse } from '../responses.js';
import type { WorkerHandler } from '../types.js';

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

export function withAuthorization(next: WorkerHandler): WorkerHandler {
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

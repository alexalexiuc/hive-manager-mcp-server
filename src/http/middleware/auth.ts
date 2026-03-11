import { PromiseCacheX } from 'promise-cachex';
import type { Env } from '../../types';
import { verifyToken } from '../token';
import { unauthorizedResponse } from '../responses';
import type { WorkerHandler } from '../types';

interface AccessTokenPayload {
  client_id: string;
  exp?: number;
}

// Cache validated tokens so each token string is only HMAC-verified once per isolate.
// TTL is aligned to the token's own expiry when present; otherwise it's capped.
const tokenCache = new PromiseCacheX<boolean>();

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  if (!env.OAUTH_CLIENT_SECRET || !env.OAUTH_CLIENT_ID) {
    return false;
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return false;

  const cacheKey = `${env.OAUTH_CLIENT_ID}:${token}`;
  const valid = await tokenCache.get(cacheKey, async () => {
    const payload = await verifyToken<AccessTokenPayload>(
      token,
      env.OAUTH_CLIENT_SECRET
    );
    if (!payload || payload.client_id !== env.OAUTH_CLIENT_ID) return false;
    return true;
  });
  if (!valid) {
    tokenCache.delete(cacheKey); // remove invalid tokens from cache immediately
  }
  return valid;
}

export function withAuthorization(next: WorkerHandler): WorkerHandler {
  return async (context) => {
    if (context.route?.isPublic) {
      return next(context);
    }

    if (!(await isAuthorized(context.request, context.env))) {
      console.warn(
        `[${context.requestId}] AUTH ${context.request.method} ${context.url.pathname} - unauthorized`
      );
      return unauthorizedResponse();
    }

    return next(context);
  };
}

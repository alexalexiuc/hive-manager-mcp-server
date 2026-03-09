import { PromiseCacheX } from 'promise-cachex';
import type { Env } from '../../types.js';
import { verifyToken, base64urlDecodeStr } from '../token.js';
import { unauthorizedResponse } from '../responses.js';
import type { WorkerHandler } from '../types.js';

interface AccessTokenPayload {
  client_id: string;
  exp: number;
}

// Cache validated tokens so each token string is only HMAC-verified once per isolate.
// TTL is aligned to the token's own expiry so stale tokens are never served from cache.
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
  const valid = await tokenCache.get(
    cacheKey,
    async () => {
      const payload = await verifyToken<AccessTokenPayload>(
        token,
        env.OAUTH_CLIENT_SECRET
      );
      if (!payload || payload.client_id !== env.OAUTH_CLIENT_ID) return false;
      return true;
    },
    { ttl: computeTtl(token) }
  );
  if (!valid) {
    tokenCache.delete(cacheKey); // remove invalid tokens from cache immediately
  }
  return valid;
}

/** Extract the expiry from the token payload without re-verifying the signature. */
function computeTtl(token: string): number {
  const MAX_TTL = 3600 * 1000; // cap at 1 hour regardless of claimed exp
  try {
    const dot = token.indexOf('.');
    if (dot === -1) return 0;
    const payload = JSON.parse(base64urlDecodeStr(token.slice(0, dot))) as {
      exp?: number;
    };
    const remaining = (payload.exp ?? 0) - Date.now();
    return remaining > 0 ? Math.min(remaining, MAX_TTL) : 0;
  } catch {
    return 0;
  }
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
